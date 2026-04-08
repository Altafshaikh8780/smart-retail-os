import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Smartphone, Laptop, Tablet, Headphones, Cpu, RefreshCw, AlertCircle, CheckCircle, Package, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { collection, getDocs, doc, deleteDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { AddProductModal } from "../components/AddProductModal";
import { exportProductsCSV } from "../lib/csvExport";
import { formatCurrency } from "../lib/validations";

// --- Data Contracts ---
const CATEGORIES = ["All", "Phones", "Laptops", "Tablets", "Accessories", "Small Electronics", "Second-hand"];

type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  category: string;
  images?: string[];
  icon?: React.ElementType;
  sku?: string;
  costPrice?: number;
  supplierId?: string;
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Phones": return Smartphone;
    case "Laptops": return Laptop;
    case "Tablets": return Tablet;
    case "Accessories": return Headphones;
    case "Small Electronics": return Cpu;
    case "Second-hand": return RefreshCw;
    default: return Package;
  }
};

export const Products: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  
  // Products Data State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(15);
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const LIMIT_STEP = 15;

  // Debounce search input (150ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchAllProducts = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "products"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({
          id: doc.id,
          name: data.name || "Unknown",
          brand: data.brand || "Unknown",
          price: Number(data.price) || 0,
          stock: Number(data.stock) || 0,
          category: data.category || "Phones",
          images: data.images || [],
          sku: data.sku || "",
          costPrice: Number(data.costPrice) || 0,
          supplierId: data.supplierId || "",
        });
      });

      setAllProducts(productsData);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast.error("Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

  const handleDeleteProduct = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    try {
      const toastId = toast.loading("Deleting product...");
      await deleteDoc(doc(db, "products", productId));
      
      const invQuery = query(collection(db, "inventory"), where("productId", "==", productId));
      const invSnap = await getDocs(invQuery);
      const deletePromises = invSnap.docs.map(d => deleteDoc(doc(db, "inventory", d.id)));
      await Promise.all(deletePromises);
      
      toast.dismiss(toastId);
      toast.success("Product deleted successfully");
      setAllProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error: any) {
      toast.error("Failed to delete product: " + error.message);
    }
  };

  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.brand.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (product.sku || "").toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const matchesStock =
        stockFilter === "all" ? true :
        stockFilter === "low" ? product.stock > 0 && product.stock <= 5 :
        stockFilter === "out" ? product.stock === 0 : true;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [allProducts, debouncedSearch, activeCategory, stockFilter]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleLimit);
  }, [filteredProducts, visibleLimit]);

  const hasMore = visibleLimit < filteredProducts.length;

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your inventory and product catalog.</p>
        </motion.div>
        
        <div className="flex items-center gap-3">
          {role === "Admin" && (
            <>
              <motion.button
                onClick={() => exportProductsCSV(filteredProducts)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2 text-sm"
              >
                <span>⬇</span> Export CSV
              </motion.button>
              <motion.button 
                onClick={() => setIsModalOpen(true)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-white px-4 py-2 rounded-lg font-medium shadow-soft hover:shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="w-5 h-5" />
                Add Product
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* 2. Search + Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-card p-4 rounded-lg shadow-soft border border-gray-100 flex flex-col gap-4"
      >
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

          <div className="flex items-center gap-2">
            {(["all", "low", "out"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStockFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  stockFilter === f
                    ? f === "out" ? "bg-red-500 text-white" : f === "low" ? "bg-yellow-500 text-white" : "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? "All Stock" : f === "low" ? "⚠ Low Stock" : "🔴 Out of Stock"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-2 -mx-4 px-4 no-scrollbar scroll-smooth">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setVisibleLimit(LIMIT_STEP); // Reset limit on filter change
                }}
                className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 border shadow-sm ${
                  activeCategory === category 
                    ? "bg-primary text-white border-primary" 
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className="uppercase tracking-widest text-[11px]">{category}</span>
              </button>
            ))}
          </div>
      </motion.div>

      {/* 3. Product Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading products...</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <AnimatePresence mode="popLayout">
            {visibleProducts.map((product) => {
              const Icon = getCategoryIcon(product.category);
              const isLowStock = product.stock > 0 && product.stock <= 5;
              const isOutOfStock = product.stock === 0;
              return (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  onClick={() => navigate(`/products/${product.id}`)}
                  className={`bg-card rounded-lg shadow-soft border overflow-hidden cursor-pointer group flex flex-col relative ${
                    isOutOfStock ? "border-red-300 ring-1 ring-red-300" :
                    isLowStock  ? "border-yellow-300 ring-1 ring-yellow-300" :
                    "border-gray-100"
                  }`}
                >
                  {role === "Admin" && (
                    <button 
                      onClick={(e) => handleDeleteProduct(e, product.id)}
                      className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 backdrop-blur-sm rounded-md text-gray-400 hover:text-red-500 hover:bg-white shadow-md opacity-70 group-hover:opacity-100 transition-all duration-200"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="aspect-square bg-gray-50 flex items-center justify-center relative border-b border-gray-100 group-hover:bg-primary/5 transition-colors overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <Icon className="w-16 h-16 text-gray-300 group-hover:text-primary/40 transition-colors" />
                    )}
                    <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold text-gray-600 shadow-sm z-10">
                      {product.brand}
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-gray-900 truncate" title={product.name}>{product.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                    
                    <div className="mt-4 flex items-end justify-between mt-auto">
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(product.price)}</span>
                      
                      <div className="flex items-center gap-1.5" title={`${product.stock} in stock`}>
                        {product.stock > 10 ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium text-green-600">{product.stock}</span>
                          </>
                        ) : product.stock > 0 ? (
                          <>
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs font-medium text-yellow-600">Low</span>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Out of Stock</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
      
      {!loading && filteredProducts.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="py-12 flex flex-col items-center justify-center text-center"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No products found</h3>
          <p className="text-gray-500 max-w-sm mt-1">We couldn't find any products matching your search or filter criteria.</p>
        </motion.div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-8 pb-4">
          <button
            onClick={() => setVisibleLimit(prev => prev + LIMIT_STEP)}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center min-w-[140px]"
          >
            Load More
          </button>
        </div>
      )}

      <AddProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchAllProducts} 
      />
    </div>
  );
};
