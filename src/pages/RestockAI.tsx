import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BrainCircuit as Brain, Info as InfoIcon, ShoppingCart as Cart, Loader2 as Loader } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";
import { RestockModal } from "../components/RestockModal";

type UrgencyLevel = "Critical" | "High" | "Moderate";

type RestockRecommendation = {
  id: string; // productId
  inventoryId: string;
  product: string;
  sold30Days: number;
  currentStock: number;
  suggestedRestock: number;
  urgency: UrgencyLevel;
  minThreshold: number;
};

export const RestockAI: React.FC = () => {
  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RestockRecommendation | null>(null);

  const fetchAIInsights = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const minStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      // Orders over last 30 days
      const ordersQuery = query(collection(db, "orders"), where("date", ">=", minStr));
      const [ordersSnap, productsSnap, invSnap] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "inventory"))
      ]);

      const soldMap: Record<string, number> = {};
      ordersSnap.forEach(d => {
        const order = d.data();
        if (Array.isArray(order.lineItems)) {
          order.lineItems.forEach((item: any) => {
            if (item.productId) {
              soldMap[item.productId] = (soldMap[item.productId] || 0) + (Number(item.quantity) || 1);
            }
          });
        }
      });

      const invMap: Record<string, string> = {};
      invSnap.forEach(d => {
        const data = d.data();
        if (data.productId) invMap[data.productId] = d.id;
      });

      const recs: RestockRecommendation[] = [];

      productsSnap.forEach(d => {
        const prod = d.data();
        if (prod.category === "Second-hand") return;

        const stock = Number(prod.stock) || 0;
        const sold30 = soldMap[d.id] || 0;
        const minStock = Number(prod.minStock) || 10;
        
        // Conservative suggestion logic
        let suggestedRestock = Math.ceil((sold30 / 30) * 7) + Math.max(0, minStock - stock);
        if (suggestedRestock < 5 && (stock <= minStock)) suggestedRestock = 5; 
        if (suggestedRestock > 100) suggestedRestock = 100; // Cap
        
        if (stock <= minStock || sold30 > 0) {
          let urgency: UrgencyLevel = "Moderate";
          if (stock <= (minStock * 0.3)) {
            urgency = "Critical"; 
          } else if (stock <= minStock) {
            urgency = "High";
          } else if (sold30 > stock * 2) {
            urgency = "Moderate";
          } else {
             return;
          }

          recs.push({
            id: d.id, 
            inventoryId: invMap[d.id] || "",
            product: prod.name || "Unknown Product",
            sold30Days: sold30,
            currentStock: stock,
            suggestedRestock: Math.ceil(suggestedRestock),
            urgency,
            minThreshold: minStock
          });
        }
      });

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

  useEffect(() => {
    fetchAIInsights();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Restock Suggestions</h1>
            <p className="text-gray-500 text-sm mt-1">Smart inventory predictions based on sales velocity.</p>
          </div>
        </motion.div>
        
        <button 
          onClick={fetchAIInsights}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          Refresh AI
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-100 flex items-start gap-3"
      >
        <InfoIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-blue-900">Sales Intelligence</h3>
          <p className="text-sm text-blue-700 mt-1">
            Analyzing last 30 days of sales to predict optimal stock levels. Suggestions aim to provide a safe buffer.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-lg border border-gray-100 shadow-soft">
            <Loader className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="font-medium text-gray-500">Generating restock suggestions...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-lg border border-green-100 shadow-soft bg-green-50/50">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <Brain className="w-8 h-8" />
            </div>
            <p className="font-bold text-gray-900 text-lg">Inventory is Optimal!</p>
          </div>
        ) : (
          recommendations.map((item, index) => {
            const stockPercentage = Math.min(Math.max((item.currentStock / (item.sold30Days || 1)) * 100, 5), 100);
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-card p-5 rounded-xl shadow-soft border flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-shadow hover:shadow-md
                  ${item.urgency === 'Critical' ? 'border-red-200 bg-red-50/10' : 
                    item.urgency === 'High' ? 'border-orange-200' : 'border-gray-100'}`}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900 text-lg">{item.product}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                      ${item.urgency === 'Critical' ? 'bg-red-100 text-red-700 animate-pulse' : 
                        item.urgency === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                      {item.urgency}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div>Sold (30d): <span className="font-bold text-gray-900">{item.sold30Days}</span></div>
                    <div>Stock: <span className="font-bold text-gray-900">{item.currentStock}</span></div>
                  </div>
                </div>

                <div className="flex-1 w-full max-w-xs">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500 font-medium">Stock Vitality</span>
                    <span className="font-bold">{Math.round(stockPercentage)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 
                        ${item.urgency === 'Critical' ? 'bg-red-500' : 
                          item.urgency === 'High' ? 'bg-orange-500' : 'bg-primary'}`}
                      style={{ width: `${stockPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Suggest</p>
                    <p className="text-lg font-black text-gray-900">+{item.suggestedRestock}</p>
                  </div>
                  
                  <button 
                    disabled={!item.inventoryId}
                    onClick={() => setSelectedItem(item)}
                    className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-soft hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Cart className="w-4 h-4" />
                    Restock
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {selectedItem && (
        <RestockModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={() => fetchAIInsights()}
          inventoryId={selectedItem.inventoryId}
          productId={selectedItem.id}
          productName={selectedItem.product}
          currentStock={selectedItem.currentStock}
          minStock={selectedItem.minThreshold}
        />
      )}
    </div>
  );
};
