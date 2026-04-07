import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Tag, Info, Plus, Smartphone, Battery, Wrench, AlertCircle, RefreshCw } from "lucide-react";
import { useSettingsStore } from "../store/settingsStore";
import { AddSecondHandModal } from "../components/AddSecondHandModal";
import { useAuth } from "../lib/auth";

type Condition = "Excellent" | "Good" | "Fair" | "Damaged";

interface SecondHandProduct {
  id: string;
  name: string;
  brand: string;
  model?: string;
  price: number;
  costPrice?: number;
  stock: number;
  condition: Condition;
  imei?: string;
  images: string[];
  description: string;
  deviceStatus?: string;
  batteryHealth?: number;
  boughtFrom?: string;
  notes?: string;
}

const CONDITION_STYLES: Record<string, string> = {
  Excellent: "bg-green-500 text-white",
  Good: "bg-blue-500 text-white",
  Fair: "bg-orange-500 text-white",
  Damaged: "bg-red-500 text-white",
};

export const SecondHand: React.FC = () => {
  const { settings } = useSettingsStore();
  const currency = settings.currency || "₹";
  const { role } = useAuth();
  const isAdmin = role === "Admin";

  const [products, setProducts] = useState<SecondHandProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState<"All" | Condition>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSecondHand = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // Simple single-field query — avoids composite index requirement.
      // Sort by createdAt client-side after fetch.
      const q = query(
        collection(db, "products"),
        where("isSecondHand", "==", true),
        limit(100)
      );
      const snap = await getDocs(q);
      const data: SecondHandProduct[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        data.push({
          id: doc.id,
          name: d.name || "Unknown",
          brand: d.brand || "N/A",
          model: d.model || "",
          price: d.price || 0,
          costPrice: d.costPrice,
          stock: d.stock || 0,
          condition: (d.condition as Condition) || "Good",
          imei: d.imei || d.sku || "N/A",
          images: d.images || [],
          description: d.description || "",
          deviceStatus: d.deviceStatus,
          batteryHealth: d.batteryHealth,
          boughtFrom: d.boughtFrom,
          notes: d.notes,
        });
      });

      // Client-side sort: newest first (by Firestore Timestamp or fallback)
      data.sort((a, b) => {
        const aTime = (snap.docs.find(d => d.id === a.id)?.data()?.createdAt?.seconds) || 0;
        const bTime = (snap.docs.find(d => d.id === b.id)?.data()?.createdAt?.seconds) || 0;
        return bTime - aTime;
      });

      setProducts(data);
    } catch (err: any) {
      console.error("[SecondHand] Failed to fetch devices:", err);
      setFetchError("Unable to load second-hand devices. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecondHand();
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.imei?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.model?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCondition = conditionFilter === "All" || p.condition === conditionFilter;
      return matchSearch && matchCondition;
    });
  }, [products, searchQuery, conditionFilter]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold text-gray-900">Second-Hand Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">Manage pre-owned devices with full condition and pricing details.</p>
        </motion.div>

        <motion.button
          onClick={() => setIsModalOpen(true)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-violet-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-5 h-5" />
          Add Second-Hand Device
        </motion.button>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card p-4 rounded-xl shadow-soft border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="relative max-w-lg w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, brand, model, or IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(["All", "Excellent", "Good", "Fair", "Damaged"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setConditionFilter(c)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                conditionFilter === c
                  ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200"
                  : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200"
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Grid */}
      {fetchError ? (
        <div className="py-16 text-center bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-red-700">Failed to Load Devices</h3>
          <p className="text-sm text-red-500 mt-1 max-w-sm mx-auto">{fetchError}</p>
          <button onClick={fetchSecondHand} className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 mx-auto">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-72 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((product) => {
              const margin = product.costPrice && product.costPrice > 0
                ? (((product.price - product.costPrice) / product.price) * 100).toFixed(1)
                : null;
              return (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-card rounded-xl shadow-soft border border-gray-100 overflow-hidden group flex flex-col"
                >
                  {/* Image */}
                  <div className="aspect-video relative overflow-hidden bg-gray-100">
                    {product.images[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Smartphone className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm ${CONDITION_STYLES[product.condition] || "bg-gray-500 text-white"}`}>
                        {product.condition.toUpperCase()}
                      </span>
                      {product.deviceStatus === "Parts Replaced" && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-400 text-white shadow-sm">
                          REPAIRED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1 text-sm">{product.name}</h3>
                        <p className="text-xs text-gray-400 font-medium">{product.brand} {product.model}</p>
                      </div>
                      <span className="text-base font-black text-gray-900">{currency}{product.price.toLocaleString()}</span>
                    </div>

                    {/* Admin-only: cost & margin */}
                    {isAdmin && product.costPrice !== undefined && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-gray-400">Cost: {currency}{product.costPrice.toLocaleString()}</span>
                        {margin && <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">+{margin}%</span>}
                      </div>
                    )}

                    {/* Battery for Apple */}
                    {product.batteryHealth !== null && product.batteryHealth !== undefined && (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${product.batteryHealth >= 80 ? "text-green-600" : "text-amber-600"}`}>
                        <Battery className="w-3.5 h-3.5" />
                        Battery: {product.batteryHealth}%
                      </div>
                    )}

                    {product.deviceStatus === "Parts Replaced" && product.boughtFrom && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600">
                        <Wrench className="w-3.5 h-3.5" />
                        Parts replaced
                      </div>
                    )}

                    <div className="mt-auto space-y-1.5 pt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-mono truncate">IMEI: {product.imei}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.stock > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>
                          {product.stock > 0 ? `IN STOCK: ${product.stock}` : "OUT OF STOCK"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-20 text-center bg-white rounded-xl border-2 border-dashed border-gray-100">
          <Tag className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">No second-hand devices found</h3>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or add a new device.</p>
        </div>
      )}

      <AddSecondHandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSecondHand}
      />
    </div>
  );
};
