import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ShoppingCart, Plus, Minus, CreditCard, User, Phone, MapPin, Loader2, PackageOpen } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import toast from 'react-hot-toast';
import { writeBatch, doc, collection, serverTimestamp, getDocs, query, where, limit, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { logActivity } from '../lib/activityLogger';
import { validatePhone, formatCurrency } from '../lib/validations';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { items, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore();
  const { user } = useAuth();
  
  const [checkoutPhase, setCheckoutPhase] = useState<'cart' | 'checkout'>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [taxRate, setTaxRate] = useState<number>(0.18);
  const [isTaxManuallySet, setIsTaxManuallySet] = useState(false);
  const { updateIMEI } = useCartStore();
  
  React.useEffect(() => {
    if (isTaxManuallySet || items.length === 0) return;
    const cat = items[0].category || "";
    let autoTax = 0.18;
    if (cat === "Second-hand") autoTax = 0;
    else if (["Accessories"].includes(cat)) autoTax = 0.12;
    setTaxRate(autoTax);
  }, [items, isTaxManuallySet]);
  
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    customerTier: 'Standard' as 'Standard' | 'VIP' | 'Wholesale',
    paymentMethod: 'Card' as 'Card' | 'Cash' | 'UPI',
    isNewCustomer: false,
    selectedCustomerId: ''
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);

  const searchCustomers = async (queryStr: string) => {
    if (queryStr.length < 2) {
      setCustomerOptions([]);
      return;
    }
    try {
      const q = query(
        collection(db, "customers"), 
        where("phone", ">=", queryStr), 
        where("phone", "<=", queryStr + "\uf8ff"),
        limit(5)
      );
      const snap = await getDocs(q);
      const results: any[] = [];
      snap.forEach(d => results.push({ id: d.id, ...d.data() }));
      setCustomerOptions(results);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const selectCustomer = (customer: any) => {
    setFormData({
      ...formData,
      customerName: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      customerTier: customer.loyaltyTier || 'Standard',
      selectedCustomerId: customer.id,
      isNewCustomer: false
    });
    setCustomerOptions([]);
    setCustomerSearch(customer.phone);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setCheckoutPhase('cart');
    onClose();
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!formData.customerName || !formData.phone) {
      toast.error("Customer name and phone are required");
      return;
    }

    if (!validatePhone(formData.phone)) {
      toast.error("Invalid phone number. Must be exactly 10 digits.");
      return;
    }

    let hasImeiError = false;
    const allImeis = new Set<string>();
    for (const item of items) {
      if (item.category === 'Phones' || item.category === 'Mobile' || item.category === 'Laptops') {
        // Let's enforce IMEI for phones
        if (item.category === 'Phones' || item.category === 'Mobile') {
          for (let i = 0; i < item.quantity; i++) {
            const imei = item.imeis?.[i];
            if (!imei) {
              toast.error(`IMEI required for ${item.name}`);
              hasImeiError = true;
            } else if (!/^\d+$/.test(imei)) {
              toast.error(`IMEI must be numeric for ${item.name}`);
              hasImeiError = true;
            } else if (allImeis.has(imei)) {
              toast.error(`Duplicate IMEI detected: ${imei}`);
              hasImeiError = true;
            } else {
              allImeis.add(imei);
            }
          }
        }
      }
    }
    if (hasImeiError) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Processing order...");

    try {
      const batch = writeBatch(db);
      const today = new Date().toISOString().split('T')[0];
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const invoiceId = `INV-${orderNumber.split('-')[1]}`;

      let finalCustomerId = formData.selectedCustomerId;

      // 1. Prepare Line Items and Totals
      const lineItems = items.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        category: item.category || "General",
        discount: 0,
        total: item.quantity * item.price,
        costPrice: item.costPrice || 0,
        imeis: item.imeis || [],
        isSecondHand: item.category === 'Second-hand' || !!item.isSecondHand
      }));

      const subtotal = getSubtotal();
      const gstAmount = subtotal * taxRate;
      const preDiscountTotal = subtotal + gstAmount;
      const discountRate = formData.customerTier === 'VIP' ? 0.02 : formData.customerTier === 'Wholesale' ? 0.05 : 0;
      const discountAmount = preDiscountTotal * discountRate;
      const finalTotal = preDiscountTotal - discountAmount;

      // 1A. Create New Customer if needed
      if (formData.isNewCustomer) {
        const customerRef = doc(collection(db, "customers"));
        batch.set(customerRef, {
          name: formData.customerName,
          phone: formData.phone,
          address: formData.address,
          loyaltyTier: formData.customerTier,
          totalPurchases: 1,
          totalSpent: finalTotal, // Use final total since it's the first purchase
          lastPurchaseDate: today,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        finalCustomerId = customerRef.id;
      } else if (finalCustomerId) {
        // 1B. Update existing customer stats dynamically
        const custRef = doc(db, "customers", finalCustomerId);
        batch.update(custRef, {
          totalPurchases: increment(1),
          totalSpent: increment(finalTotal),
          lastPurchaseDate: today,
          updatedAt: serverTimestamp()
        });
      }

      // 2. Order Doc
      const orderRef = doc(collection(db, "orders"));
      batch.set(orderRef, {
        orderNumber,
        customer: formData.customerName,
        total: finalTotal,
        gst: gstAmount,
        taxRate: taxRate,
        paymentMethod: formData.paymentMethod,
        status: "Completed",
        date: today,
        lineItems,
        cashierId: user?.uid || "system",
        customerId: finalCustomerId,
        discountAmount: discountAmount,
        customerTier: formData.customerTier,
        createdAt: serverTimestamp()
      });

      // 3. Invoice Doc
      const invoiceRef = doc(collection(db, "invoices"));
      batch.set(invoiceRef, {
        invoiceId,
        orderId: orderNumber,
        customer: formData.customerName, // Legacy compatibility
        customerName: formData.customerName,
        phone: formData.phone,
        billingAddress: formData.address || "",
        subtotal,
        gst: gstAmount,
        discountAmount,
        total: finalTotal,
        status: "Paid",
        paymentMethod: formData.paymentMethod,
        paymentStatus: "Paid",
        dueDate: today,
        paymentTerms: "Due on receipt",
        source: "auto",
        date: today,
        lineItems,
        createdAt: serverTimestamp()
      });

      // 4. Update Inventory & Products Stock
      // Note: We are relying on the UI checks to prevent quantity > stock, 
      // but in a fully strict environment, we would re-fetch and validate here.
      for (const item of items) {
        const productRef = doc(db, "products", item.productId);
        const invQuery = query(collection(db, "inventory"), where("productId", "==", item.productId));
        const invSnap = await getDocs(invQuery);

        if (item.category === "Second-hand") {
          // Delete second-hand product completely
          batch.delete(productRef);
          if (!invSnap.empty) {
            batch.delete(doc(db, "inventory", invSnap.docs[0].id));
          }
        } else {
          // Update products collection
          const newStock = item.stock - item.quantity;
          batch.update(productRef, {
            stock: newStock,
            lastUpdated: serverTimestamp()
          });

          // Update inventory collection
          if (!invSnap.empty) {
            const invDoc = invSnap.docs[0];
            batch.update(doc(db, "inventory", invDoc.id), {
              stock: newStock,
              lastUpdated: serverTimestamp()
            });
          }
        }
      }

      // 5. Notifications
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        type: 'new_order',
        title: 'New Order Received',
        message: `Order ${orderNumber} created for ${formData.customerName}`,
        referenceId: orderRef.id,
        read: false,
        createdAt: serverTimestamp()
      });

      // Commit Batch
      await batch.commit();

      // Log activity (non-blocking)
      logActivity({
        action: "order.created",
        actorId: user?.uid || "system",
        actorName: user?.email || undefined,
        targetId: orderNumber,
        meta: { total: finalTotal, itemCount: items.length, paymentMethod: formData.paymentMethod },
      });

      toast.success("Order completed successfully!", { id: toastId });
      
      // Cleanup
      clearCart();
      setFormData({ customerName: '', phone: '', address: '', customerTier: 'Standard', paymentMethod: 'Card', isNewCustomer: false, selectedCustomerId: '' });
      setCustomerSearch('');
      handleClose();

    } catch (error: any) {
      console.error("Checkout processing error:", error);
      toast.error(error.message || "Failed to process checkout.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100]"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl z-[101] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {checkoutPhase === 'cart' ? (
                  <>
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    Shopping Cart
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 text-primary" />
                    Checkout
                  </>
                )}
              </h2>
              <button 
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <PackageOpen className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-900">Your cart is empty</p>
                  <p className="text-sm mt-1">Add items from the store to continue.</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {checkoutPhase === 'cart' ? (
                    <motion.div 
                      key="cart"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      {items.map((item) => (
                        <div key={item.productId} className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg bg-gray-50" />
                          ) : (
                            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                              <PackageOpen className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          
                          <div className="flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-gray-900 leading-tight">{item.name}</h4>
                                <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(item.price)}</p>
                              </div>
                              <button 
                                onClick={() => removeItem(item.productId)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button 
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                                  disabled={item.quantity >= item.stock}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="text-sm font-bold text-primary">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>
                            
                            {/* IMEI Inputs */}
                            {(item.category === 'Phones' || item.category === 'Mobile') && (
                                <div className="mt-3 space-y-2 border-t border-gray-100 pt-2">
                                  {Array.from({ length: item.quantity }).map((_, idx) => (
                                    <input 
                                      key={idx}
                                      placeholder={`IMEI for unit ${idx + 1} (Numeric)`}
                                      value={item.imeis?.[idx] || ''}
                                      onChange={(e) => updateIMEI(item.productId, idx, e.target.value.replace(/\D/g, ''))}
                                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      required
                                    />
                                  ))}
                                </div>
                            )}

                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="checkout"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <form id="checkoutForm" onSubmit={handleCheckout} className="space-y-5">
                        {/* Customer Search / New Customer Toggle */}
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-900">Customer Selection</label>
                            <button 
                              type="button"
                              onClick={() => setFormData({...formData, isNewCustomer: !formData.isNewCustomer, selectedCustomerId: ''})}
                              className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${formData.isNewCustomer ? "bg-primary text-white" : "bg-white text-primary border border-primary/20"}`}
                            >
                              {formData.isNewCustomer ? "Registering New" : "Select Existing"}
                            </button>
                          </div>

                          {!formData.isNewCustomer ? (
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 font-bold" />
                              <input 
                                type="text"
                                placeholder="Search by Phone Number..."
                                value={customerSearch}
                                onChange={(e) => {
                                  setCustomerSearch(e.target.value);
                                  searchCustomers(e.target.value);
                                }}
                                className="w-full bg-white border border-gray-200 rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                              />
                              <AnimatePresence>
                                {customerOptions.length > 0 && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden"
                                  >
                                    {customerOptions.map(c => (
                                      <button 
                                        key={c.id}
                                        type="button"
                                        onClick={() => selectCustomer(c)}
                                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex flex-col transition-colors border-b last:border-0 border-gray-50"
                                      >
                                        <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                                        <span className="text-xs text-gray-500 font-medium">{c.phone}</span>
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div className="space-y-3 pt-1">
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                  required 
                                  value={formData.customerName} 
                                  onChange={e => setFormData({...formData, customerName: e.target.value})} 
                                  className="w-full border border-gray-200 bg-white rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold" 
                                  placeholder="Full Name" 
                                />
                              </div>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                  required 
                                  type="tel"
                                  maxLength={10}
                                  value={formData.phone} 
                                  onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                                  className="w-full border border-gray-200 bg-white rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold font-mono" 
                                  placeholder="10-digit mobile" 
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1.5 opacity-50">Additional Details</label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <textarea 
                              value={formData.address} 
                              onChange={e => setFormData({...formData, address: e.target.value})} 
                              className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm resize-none font-medium" 
                              placeholder="Delivery Address (Optional)" 
                              rows={2}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Customer Tier</label>
                            <select 
                              value={formData.customerTier} 
                              onChange={e => setFormData({...formData, customerTier: e.target.value as any})} 
                              className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                            >
                              <option value="Standard">Standard (0%)</option>
                              <option value="VIP">VIP (2%)</option>
                              <option value="Wholesale">Wholesale (5%)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Payment Method</label>
                            <select 
                              value={formData.paymentMethod} 
                              onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})} 
                              className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                            >
                              <option value="Card">Credit / Debit Card</option>
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI / Digital Wallet</option>
                            </select>
                          </div>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Footer Summary */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-6 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 items-center">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatCurrency(getSubtotal())}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 items-center">
                    <div className="flex items-center gap-2">
                      <span>GST / Tax</span>
                      <select 
                        value={taxRate.toString()} 
                        onChange={(e) => {
                          setTaxRate(Number(e.target.value));
                          setIsTaxManuallySet(true);
                        }}
                        className="bg-gray-100 border-none text-xs rounded px-1.5 py-0.5 focus:ring-1 focus:ring-primary"
                      >
                        <option value="0">0%</option>
                        <option value="0.05">5%</option>
                        <option value="0.12">12%</option>
                        <option value="0.18">18%</option>
                        <option value="0.28">28%</option>
                      </select>
                    </div>
                    <span className="font-semibold">{formatCurrency(getSubtotal() * taxRate)}</span>
                  </div>
                  {(formData.customerTier !== 'Standard') && (
                    <div className="flex justify-between text-green-600 font-bold items-center">
                      <span>Tier Discount ({formData.customerTier === 'VIP' ? '2%' : '5%'})</span>
                      <span>-{formatCurrency(((getSubtotal() * (1 + taxRate)) * (formData.customerTier === 'VIP' ? 0.02 : 0.05)))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatCurrency(((getSubtotal() * (1 + taxRate)) * (1 - (formData.customerTier === 'VIP' ? 0.02 : formData.customerTier === 'Wholesale' ? 0.05 : 0))))}
                    </span>
                  </div>
                </div>

                {checkoutPhase === 'cart' ? (
                  <button 
                    onClick={() => setCheckoutPhase('checkout')}
                    className="w-full py-3.5 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-soft transition-all active:scale-[0.98]"
                  >
                    Proceed to Checkout
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setCheckoutPhase('cart')}
                      className="px-4 py-3.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold transition-all"
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      form="checkoutForm"
                      disabled={isSubmitting}
                      className="flex-1 flex justify-center items-center py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
                      ) : (
                        `Pay ${formatCurrency(((getSubtotal() * (1 + taxRate)) * (1 - (formData.customerTier === 'VIP' ? 0.02 : formData.customerTier === 'Wholesale' ? 0.05 : 0))))}`
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
