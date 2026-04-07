import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles, Check } from "lucide-react";
import toast from "react-hot-toast";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStock: number) => void;
  inventoryId: string;
  productId: string;
  productName: string;
  currentStock: number;
}

export const RestockModal: React.FC<RestockModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  inventoryId,
  productId,
  productName,
  currentStock
}) => {
  // AI Mock Logic
  const suggestedQty = React.useMemo(() => Math.max(20, Math.floor(Math.random() * 50) + 20), []);
  const salesVelocity = React.useMemo(() => Math.max(1, Math.floor(Math.random() * 5)), []);
  const runOutDays = React.useMemo(() => Math.floor(currentStock / salesVelocity) || 0, [currentStock, salesVelocity]);

  const [quantity, setQuantity] = useState<string>(suggestedQty.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid restock quantity.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Restocking ${productName}...`);

    try {
      // Update both collections to maintain global synchronization
      const invRef = doc(db, "inventory", inventoryId);
      const prodRef = doc(db, "products", productId);

      await Promise.all([
        updateDoc(invRef, { stock: increment(qty) }),
        updateDoc(prodRef, { stock: increment(qty) })
      ]);

      toast.dismiss(toastId);
      toast.success(`Successfully added ${qty} units to stock!`);
      
      onSuccess(currentStock + qty);
      
      setQuantity(suggestedQty.toString()); // Reset
      onClose();
    } catch (error: any) {
      console.error("Restock error:", error);
      toast.dismiss(toastId);
      toast.error("Failed to update stock levels.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={!isSubmitting ? onClose : undefined}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 flex flex-col"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Restock Analysis
              </h2>
              <button 
                onClick={onClose} 
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-200 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Product</p>
                <p className="font-semibold text-gray-900 truncate">{productName}</p>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-sm font-medium text-gray-600">Current Stock</span>
                <span className="text-lg font-bold text-gray-900">{currentStock}</span>
              </div>

              <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                  <Sparkles className="w-4 h-4" /> AI Insights
                </div>
                <div className="text-xs text-purple-800 space-y-1 font-medium">
                  <p>• Sales Velocity: ~{salesVelocity} units/day</p>
                  <p>• Est. Run Out Date: {runOutDays <= 0 ? 'Immediately' : `in ${runOutDays} days`}</p>
                  <p>• Recommended Restock: <strong>{suggestedQty} units</strong></p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setQuantity(suggestedQty.toString())} className="flex-1 bg-purple-600 text-white py-1.5 rounded-md text-xs font-bold hover:bg-purple-700 flex justify-center items-center gap-1"><Check className="w-3 h-3"/> Approve AI Suggestion</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Manual Override Quantity</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  required 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                  className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium bg-white" 
                  placeholder="e.g. 50" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !quantity || parseInt(quantity) <= 0} 
                  className="px-5 py-2 rounded-lg flex items-center text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-soft min-w-[100px] justify-center"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Restock"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
