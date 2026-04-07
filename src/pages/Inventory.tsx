import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Package, AlertTriangle, DollarSign, Download, Filter, Search, ArrowUpDown, ChevronDown } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";
import { Skeleton } from "../components/Skeleton";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { useSettingsStore } from "../store/settingsStore";
import { formatCurrency } from "../lib/validations";

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

type InventoryItem = {
  id: string;
  productId: string;
  product: string;
  sku: string;
  category: string;
  stock: number;
  min: number;
  purchase: number;
  selling: number;
  supplier: string;
};

export const Inventory: React.FC = () => {
  const { settings } = useSettingsStore();
  const currency = settings.currency || "₹";
  const navigate = useNavigate();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [productsSnap, inventorySnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "inventory"))
      ]);

      const productsMap = new Map();
      productsSnap.forEach(doc => {
        productsMap.set(doc.id, doc.data());
      });

      const invData: InventoryItem[] = [];
      
      inventorySnap.forEach(doc => {
        const data = doc.data();
        const productInfo = productsMap.get(data.productId) || {};
        
        invData.push({
          id: doc.id,
          productId: data.productId,
          product: data.name || productInfo.name || "Unknown Product",
          sku: data.productId ? data.productId.substring(0, 8).toUpperCase() : "UNKNOWN",
          category: productInfo.category || "Uncategorized",
          stock: Number(data.stock) || 0,
          min: Number(data.minStock) || 0,
          purchase: Number(data.purchasePrice) || 0,
          selling: Number(data.sellingPrice) || 0,
          supplier: data.supplierName || productInfo.supplierName || "N/A"
        });
      });

      // Sort by stock logically ascending
      invData.sort((a, b) => a.stock - b.stock);
      setInventoryItems(invData);
    } catch (error: any) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem; direction: 'asc' | 'desc' } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const categories = useMemo(() => ["All", ...new Set(inventoryItems.map(i => i.category))], [inventoryItems]);

  const processedInventory = useMemo(() => {
    let result = [...inventoryItems];

    if (filterLowStock) {
      result = result.filter(item => item.stock <= item.min);
    }
    if (filterCategory !== "All") {
      result = result.filter(item => item.category === filterCategory);
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (typeof valA === 'number' && typeof valB === 'number') {
           return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        return 0; 
      });
    }

    return result;
  }, [inventoryItems, filterLowStock, filterCategory, sortConfig]);

  // --- Pagination Logic ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil(processedInventory.length / itemsPerPage);
  
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedInventory.slice(start, start + itemsPerPage);
  }, [processedInventory, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, processedInventory.length);

  const toggleSort = (key: keyof InventoryItem) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key, direction: 'asc' };
      return null;
    });
  };

  const handleExportCSV = () => {
    const headers = ["Product Name", "SKU", "Category", "Stock", "Min Stock", "Purchase Price", "Selling Price", "Status", "Export Date"];
    const exportDate = new Date().toLocaleDateString();
    
    const rows = processedInventory.map(item => [
      `"${item.product}"`,
      `"${item.sku}"`,
      `"${item.category}"`,
      item.stock,
      item.min,
      `${formatCurrency(item.purchase, currency)}`,
      `${formatCurrency(item.selling, currency)}`,
      item.stock <= 0 ? "Out of Stock" : item.stock <= item.min ? "Low Stock" : "In Stock",
      exportDate
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inventory strictly exported to CSV");
  };

  const totalValue = useMemo(() => {
    return inventoryItems.reduce((acc, item) => acc + (item.stock * item.purchase), 0);
  }, [inventoryItems]);

  const lowStockCount = useMemo(() => {
    return inventoryItems.filter(item => item.stock <= item.min).length;
  }, [inventoryItems]);

  const inventoryStats = [
    { title: "Total Products", value: inventoryItems.length.toString(), icon: Package, color: "text-blue-500", bg: "bg-blue-100" },
    { title: "Low Stock Items", value: lowStockCount.toString(), icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-100" },
    { title: "Inventory Value", value: formatCurrency(totalValue, currency), icon: DollarSign, color: "text-green-500", bg: "bg-green-100" },
  ];
  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage your stock levels across all categories.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 self-start sm:self-auto"
        >
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 border
              ${isFilterOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>
          <button 
            onClick={handleExportCSV}
            className="bg-primary text-white px-4 py-2 rounded-lg font-medium shadow-soft hover:shadow-md transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card p-4 rounded-xl shadow-soft border border-gray-100 flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Category:</span>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                  />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-primary transition-colors">Only Low Stock</span>
                </label>
              </div>
              
              <button 
                onClick={() => { setFilterCategory("All"); setFilterLowStock(false); setSortConfig(null); }}
                className="ml-auto text-sm text-gray-500 hover:text-red-500 transition-colors"
                disabled={filterCategory === "All" && !filterLowStock && !sortConfig}
              >
                Clear All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Summary Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {inventoryStats.map((stat, idx) => (
          <motion.div key={idx} variants={itemVariants}>
            <StatCard 
              title={stat.title}
              value={stat.value}
              icon={<stat.icon className="w-7 h-7" />}
              colorClass={stat.color}
              iconBgClass={stat.bg}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* 3. Inventory Table */}
      {loading ? (
        <div className="bg-card p-6 rounded-lg border border-gray-100 shadow-soft">
          <div className="space-y-4">
             {[1, 2, 3, 4, 5].map(i => (
               <Skeleton key={i} className="h-12 w-full" />
             ))}
          </div>
        </div>
      ) : inventoryItems.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="py-24 flex flex-col items-center justify-center text-center bg-card rounded-lg border border-gray-100 shadow-soft"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
             <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No inventory found</h3>
          <p className="text-gray-500 max-w-sm mt-1">Add items to the product catalog to automatically populate the master inventory.</p>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-semibold">Product & SKU</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('stock')}>
                  <div className="flex items-center gap-1.5">
                    Stock Level
                    <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig?.key === 'stock' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('selling')}>
                  <div className="flex items-center gap-1.5">
                    Pricing (Purchase / Selling)
                    <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig?.key === 'selling' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
              </tr>
            </thead>
            <AnimatePresence mode="popLayout">
              <tbody className="divide-y divide-gray-100 text-sm">
                {paginatedInventory.map((item) => {
                const isLowStock = item.stock <= item.min;
                
                return (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={item.id} 
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    <td 
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/products/${item.productId}`)}
                    >
                      <p className="text-gray-900 font-bold hover:text-primary transition-colors hover:underline underline-offset-4">{item.product}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{item.sku}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.category}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isLowStock ? "text-orange-600" : "text-gray-900"}`}>
                          {item.stock}
                        </span>
                        <span className="text-gray-400 text-xs">/ Min: {item.min}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isLowStock ? "bg-orange-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min((item.stock / (item.min * 2)) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.stock <= 0 ? (
                        <Badge variant="danger" className="gap-1.5">
                          <AlertTriangle className="w-3 h-3" />
                          Out of Stock
                        </Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning" className="gap-1.5 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge variant="success">In Stock</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">Buy: {formatCurrency(item.purchase, currency)}</span>
                        <span className="text-gray-900 font-medium mt-0.5">Sell: {formatCurrency(item.selling, currency)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[120px]" title={item.supplier}>
                      {item.supplier}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
            </AnimatePresence>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 bg-gray-50/50">
          <span>
            {processedInventory.length > 0 ? (
              <>Showing <span className="font-bold text-gray-900">{startIndex}</span> to <span className="font-bold text-gray-900">{endIndex}</span> of <span className="font-bold text-gray-900">{processedInventory.length}</span> entries</>
            ) : "No entries found"}
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Prev
            </button>
            <div className="flex items-center px-4 font-bold text-gray-900 bg-gray-100 rounded-xl">
              {currentPage} / {totalPages || 1}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-4 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>
      )}
    </div>
  );
};
