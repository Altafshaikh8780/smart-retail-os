import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Loader2, Mail, Phone, User as UserIcon } from "lucide-react";
import toast from "react-hot-toast";
import { collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { validatePhone } from "../lib/validations";

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // customer is passed if editing
  customer?: any; 
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, customer }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    loyaltyTier: "Regular" as "Regular" | "VIP" | "Wholesale"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        notes: customer.notes || "",
        loyaltyTier: customer.loyaltyTier || "Regular",
      });
    } else {
      setFormData({name: "", phone: "", email: "", address: "", notes: "", loyaltyTier: "Regular"});
    }
  }, [customer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Name and Phone are required");
      return;
    }

    if (!validatePhone(formData.phone)) {
      toast.error("Invalid phone number. Must be exactly 10 digits.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(customer ? "Updating customer..." : "Adding customer...");

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        notes: formData.notes,
        loyaltyTier: formData.loyaltyTier,
        totalPurchases: customer ? customer.totalPurchases : 0,
        lastPurchaseDate: customer ? customer.lastPurchaseDate : null,
        updatedAt: serverTimestamp(),
      };

      // Direct Firestore write — Firebase's offline persistence buffers this
      // automatically and syncs when back online. No manual queue needed.
      if (customer?.id) {
        await updateDoc(doc(db, "customers", customer.id), payload);
      } else {
        const newRef = doc(collection(db, "customers"));
        await setDoc(newRef, { ...payload, createdAt: serverTimestamp() });
      }

      toast.success(`Customer ${customer ? "updated" : "added"} successfully!`, { id: toastId });
      setFormData({ name: "", phone: "", email: "", address: "", notes: "", loyaltyTier: "Regular" });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={!isSubmitting ? onClose : undefined} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                {customer ? "Edit Customer" : "Add Customer"}
              </h2>
              <button onClick={onClose} disabled={isSubmitting} className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" placeholder="e.g. John Doe" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="tel" 
                      required 
                      maxLength={10}
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-mono" 
                      placeholder="10-digit mobile number" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" placeholder="john@example.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" placeholder="123 Main St, City, Country" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Notes</label>
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm resize-none" placeholder="Customer preferences, CRM notes..." rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Loyalty Tier</label>
                  <select value={formData.loyaltyTier} onChange={e => setFormData({...formData, loyaltyTier: e.target.value as any})} className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white">
                    <option value="Regular">Regular</option>
                    <option value="VIP">VIP</option>
                    <option value="Wholesale">Wholesale</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 mt-8">
                <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg flex items-center justify-center text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors disabled:opacity-70 shadow-soft">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Customer"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
