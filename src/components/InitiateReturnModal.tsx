import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, CheckCircle, Package, ArrowRight, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";
import { processReturnTransaction } from "../lib/returnService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InitiateReturnModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [orderQuery, setOrderQuery] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const [reason, setReason] = useState("Changed Mind");
  const [refundMethod, setRefundMethod] = useState<"UPI" | "Card" | "Cash">("Card");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  const handleSearchOrder = async () => {
    if (!orderQuery.trim()) {
      toast.error("Please enter an Order ID");
      return;
    }

    setLoadingOrder(true);
    setOrderData(null);
    try {
      const q = query(collection(db, "orders"), where("orderNumber", "==", orderQuery.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("No Order found matching this ID");
        return;
      }

      const activeOrderDoc = snap.docs[0];
      const data = activeOrderDoc.data();

      if (data.status === "Returned") {
        toast.error("This order has already been returned.");
        return;
      }
      
      if (data.status !== "Completed") {
        toast.error(`Cannot return order with status: ${data.status}`);
        return;
      }

      // Handle both legacy (top-level) and new (lineItems) schemas
      const lineItems = data.lineItems || [];
      const primaryProduct = lineItems.length > 0 ? lineItems[0] : null;
      
      setOrderData({ 
        id: activeOrderDoc.id, 
        ...data,
        productId: data.productId || primaryProduct?.productId,
        productName: data.productName || primaryProduct?.name,
        itemsCount: data.items || lineItems.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0),
        displayProductName: data.productName || (primaryProduct ? `${primaryProduct.name}${lineItems.length > 1 ? ` (+${lineItems.length - 1} more items)` : ''}` : "Package Contents View Only")
      });
      setRefundAmount(data.total || 0); 
    } catch (err) {
      console.error(err);
      toast.error("Error searching orders");
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderData) return;
    if (refundAmount < 0 || refundAmount > orderData.total) { // Sanity threshold
       toast.error(`Refund amount must be between $0 and $${orderData.total}`);
       return;
    }

    setProcessing(true);
    const toastId = toast.loading("Processing atomic return payload...");

    try {
      await processReturnTransaction({
        orderId: orderData.id,
        orderNumber: orderData.orderNumber,
        productId: orderData.productId,
        productName: orderData.productName,
        customerName: orderData.customer || "Unknown",
        items: orderData.itemsCount || 1,
        reason,
        refundAmount: Number(refundAmount),
        refundMethod,
        lineItems: orderData.lineItems
      });

      toast.success("Return successfully issued", { id: toastId });
      
      // Reset Modal State
      setOrderQuery("");
      setOrderData(null);
      setReason("Changed Mind");
      onClose();

    } catch (err) {
      console.error("Return Processor Crash:", err);
      toast.error("Failed to process transaction securely", { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Initiate Return</h2>
              <p className="text-sm text-gray-500 mt-1">Locate a registered transaction payload to securely void</p>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            {/* Step 1: Search Module */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Order Identification Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="e.g. ORD-12345"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    disabled={loadingOrder || processing || orderData}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 transition-all font-mono"
                  />
                </div>
                {!orderData ? (
                  <button
                    type="button"
                    onClick={handleSearchOrder}
                    disabled={loadingOrder || !orderQuery}
                    className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center min-w-[100px] disabled:opacity-50"
                  >
                    {loadingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setOrderData(null); setOrderQuery(""); }}
                    disabled={processing}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium text-sm transition-colors flex items-center justify-center min-w-[100px] border border-red-100"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Found payload */}
            {orderData && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{orderData.displayProductName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Purchased by <span className="font-semibold text-gray-700">{orderData.customer}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">${orderData.total}</p>
                      <p className="text-xs text-blue-600 font-medium px-2 shadow-sm rounded-full bg-blue-100 border border-blue-200 mt-1 inline-flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Valid
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                     <label className="block text-sm font-semibold text-gray-900 mb-2">Reason for Return</label>
                     <select
                       value={reason}
                       onChange={(e) => setReason(e.target.value)}
                       disabled={processing}
                       className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-700"
                     >
                       <option value="Changed Mind">Changed Mind</option>
                       <option value="Defective Display">Defective Display</option>
                       <option value="Damaged in Transit">Damaged in Transit</option>
                       <option value="Wrong Item Sent">Wrong Item Sent</option>
                       <option value="Connectivity Issues">Connectivity Issues</option>
                       <option value="Other">Other Resolution</option>
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Refund Method</label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as any)}
                        disabled={processing}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-700"
                      >
                        <option value="Card">Card</option>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Credit Value ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        max={orderData.total}
                        min="0"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(Number(e.target.value))}
                        disabled={processing}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-soft hover:shadow-md transition-all mt-4 flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Authenticating Transaction...
                      </>
                    ) : (
                      <>
                        Execute Formal Void
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
