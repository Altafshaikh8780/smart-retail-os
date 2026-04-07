import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Info, AlertTriangle, TrendingDown, ShoppingCart, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";

type UrgencyLevel = "Critical" | "High" | "Moderate";

type RestockRecommendation = {
  id: string;
  product: string;
  sold30Days: number;
  currentStock: number;
  suggestedRestock: number;
  urgency: UrgencyLevel;
};

export const RestockAI: React.FC = () => {
  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAIInsights = async () => {
      setLoading(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const minStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        // Orders over last 30 days
        const ordersQuery = query(collection(db, "orders"), where("date", ">=", minStr));
        const [ordersSnap, productsSnap] = await Promise.all([
          getDocs(ordersQuery),
          getDocs(collection(db, "products"))
        ]);

        const soldMap: Record<string, number> = {};
        ordersSnap.forEach(d => {
          const order = d.data();
          const pId = order.productId;
          if (pId) {
            soldMap[pId] = (soldMap[pId] || 0) + (Number(order.items) || 1);
          }
        });

        const recs: RestockRecommendation[] = [];

        productsSnap.forEach(d => {
          const prod = d.data();
          const stock = Number(prod.stock) || 0;
          const sold30 = soldMap[d.id] || 0;
          
          const suggestedRestock = Math.max(0, sold30 - stock);
          
          if (suggestedRestock > 0) {
            let urgency: UrgencyLevel = "Moderate";
            if (stock <= (sold30 * 0.2)) {
              urgency = "Critical"; // less than 20% of 30day rate
            } else if (stock <= (sold30 * 0.5)) {
              urgency = "High";
            }

            recs.push({
              id: d.id, 
              product: prod.name || "Unknown Product",
              sold30Days: sold30,
              currentStock: stock,
              suggestedRestock,
              urgency
            });
          }
        });

        // Sort by Urgency then quantity
        recs.sort((a, b) => {
          const weight = { Critical: 3, High: 2, Moderate: 1 };
          if (weight[a.urgency] !== weight[b.urgency]) {
            return weight[b.urgency] - weight[a.urgency];
          }
          return b.suggestedRestock - a.suggestedRestock;
        });

        setRecommendations(recs);
      } catch (err) {
        console.error("AI Insight Error:", err);
        toast.error("Failed to load AI stock insights");
      } finally {
        setLoading(false);
      }
    };

    fetchAIInsights();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Restock Suggestions</h1>
            <p className="text-gray-500 text-sm mt-1">Smart inventory predictions to prevent stockouts.</p>
          </div>
        </motion.div>
      </div>

      {/* 2. Info Box */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-100 flex items-start gap-3"
      >
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-blue-900">How it works</h3>
          <p className="text-sm text-blue-700 mt-1">
            Based on last 30 days sales vs current stock. The AI analyzes your sales velocity and lead times to recommend precise restock quantities before items run out.
          </p>
        </div>
      </motion.div>

      {/* 3 & 4. List Items with Labels */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-lg border border-gray-100 shadow-soft">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="font-medium text-gray-500">Generating restock suggestions...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-lg border border-green-100 shadow-soft bg-green-50/50">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <p className="font-bold text-gray-900 text-lg">Inventory is Optimal!</p>
            <p className="font-medium text-gray-500 mt-1 max-w-sm text-center">Your current stock levels seamlessly support your 30-day velocity.</p>
          </div>
        ) : (
          recommendations.map((item, index) => {
          // Calculate progress percentage (Stock vs Sold in 30 days) to represent depletion
          // If current stock is much lower than sold, the progress bar will be mostly empty (red/critical)
          const totalNeeded = item.sold30Days;
          const stockPercentage = Math.min(Math.max((item.currentStock / totalNeeded) * 100, 5), 100);
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + (index * 0.05) }}
              className={`bg-card p-5 rounded-lg shadow-soft border flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-shadow hover:shadow-md
                ${item.urgency === 'Critical' ? 'border-red-100' : 
                  item.urgency === 'High' ? 'border-orange-100' : 'border-gray-100'}`}
            >
              {/* Product Info & Urgency */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-lg">{item.product}</h3>
                  
                  {item.urgency === "Critical" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Critical
                    </span>
                  ) : item.urgency === "High" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                      <TrendingDown className="w-3.5 h-3.5" />
                      High
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      Moderate
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div><span className="font-medium text-gray-900">Sold (30d):</span> {item.sold30Days} units</div>
                  <div><span className="font-medium text-gray-900">Current Stock:</span> {item.currentStock} units</div>
                </div>
              </div>

              {/* Progress Bar & Prediction (5) */}
              <div className="flex-1 w-full flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <span className="text-gray-500">Stock Vitality</span>
                  <span className={`${item.urgency === 'Critical' ? 'text-red-500' : item.urgency === 'High' ? 'text-orange-500' : 'text-primary'}`}>
                    {Math.round(stockPercentage)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stockPercentage}%` }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    className={`h-full rounded-full 
                      ${item.urgency === 'Critical' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                        item.urgency === 'High' ? 'bg-orange-500' : 'bg-primary'}`}
                  />
                </div>
              </div>

              {/* Action */}
              <div className="flex-shrink-0 flex items-center gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Suggested</p>
                  <p className="text-xl font-bold text-gray-900">+{item.suggestedRestock}</p>
                </div>
                
                <button className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-soft hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Order
                </button>
              </div>
            </motion.div>
          );
        })
      )}
      </div>
    </div>
  );
};
