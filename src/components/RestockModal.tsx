import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles, Check } from "lucide-react";
import toast from "react-hot-toast";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { calculateRestockRecommendation } from "../lib/aiRestock";

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStock: number) => void;
  inventoryId: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStock?: number;
}

export const RestockModal: React.FC<RestockModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  inventoryId,
  productId,
  productName,
  currentStock,
  minStock = 10
}) => {
  const [quantity, setQuantity] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<{ suggested: number; velocity: number; runOut: number } | null>(null);

  useEffect(() => {
    if (isOpen && productId) {
      const fetchRecommendation = async () => {
        setAiLoading(true);
        try {
          const result = await calculateRestockRecommendation(productId, currentStock, minStock);
          setAiData({
            suggested: result.suggestedRestockQty,
            velocity: result.dailySales,
            runOut: Math.floor(currentStock / (result.dailySales || 1))
          });
          setQuantity(result.suggestedRestockQty.toString());
        } catch (error) {
          console.error("AI Recommendation failed:", error);
          // Fallback to min-stock logic
          const fallback = Math.max(0, minStock - currentStock);
          setAiData({ suggested: fallback, velocity: 0, runOut: 0 });
          setQuantity(fallback.toString());
        } finally {
          setAiLoading(false);
        }
      };
      fetchRecommendation();
    }
  }, [isOpen, productId, currentStock, minStock]);

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
      
      setQuantity(aiData?.suggested.toString() || "0"); // Reset
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

              <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-4 space-y-3 relative overflow-hidden">
                {aiLoading && (
                  <div className="absolute inset-0 bg-purple-50/80 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  </div>
                )}
                <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                  <Sparkles className="w-4 h-4" /> AI Insights
                </div>
                <div className="text-xs text-purple-800 space-y-1 font-medium">
                  <p>• Sales Velocity: ~{aiData?.velocity || 0} units/day</p>
                  <p>• Est. Run Out Date: {aiData?.runOut && aiData.runOut > 0 ? `in ${aiData.runOut} days` : 'Immediately'}</p>
                  <p>• Recommended Restock: <strong>{aiData?.suggested || 0} units</strong></p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setQuantity(aiData?.suggested.toString() || "0")} 
                    className="flex-1 bg-purple-600 text-white py-1.5 rounded-md text-xs font-bold hover:bg-purple-700 flex justify-center items-center gap-1"
                    disabled={aiLoading}
                  >
                    <Check className="w-3 h-3"/> Approve AI Suggestion
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Manual Override Quantity</label>
                <input 
                  type="number" 
                  min="0" 
                  step="1"
                  required 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                  className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium bg-white" 
                  placeholder="e.g. 50" 
                  disabled={isSubmitting || aiLoading}
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
