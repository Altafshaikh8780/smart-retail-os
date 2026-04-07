import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, Phone, Trash2, Edit2, Loader2, Mail } from "lucide-react";
import { collection, getDocs, doc, deleteDoc, query, orderBy, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { AddCustomerModal } from "../components/AddCustomerModal";
import { logActivity } from "../lib/activityLogger";
import toast from "react-hot-toast";
import { exportCustomersCSV } from "../lib/csvExport";

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalPurchases: number;
  totalSpent?: number;
  lastPurchaseDate?: string;
  address?: string;
  billingAddress?: string;
  notes?: string;
  loyaltyTier?: "Regular" | "VIP" | "Wholesale";
};

export const Customers: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [tierFilter, setTierFilter] = useState<"all" | "Regular" | "VIP" | "Wholesale">("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input (150ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const PAGE_SIZE = 20;

  const fetchCustomers = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);

      let q;
      if (isLoadMore && lastDoc) {
        q = query(
          collection(db, "customers"),
          orderBy("name"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, "customers"),
          orderBy("name"),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);

      if (!snap.empty) {
        setLastDoc(snap.docs[snap.docs.length - 1]);
        if (snap.docs.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
      } else {
        setHasMore(false);
      }

      const data: CustomerRecord[] = [];
      snap.forEach(d => {
        data.push({ id: d.id, ...d.data() } as CustomerRecord);
      });

      if (isLoadMore) {
        setCustomers(prev => {
          const newItems = data.filter(d => !prev.some(p => p.id === d.id));
          return [...prev, ...newItems];
        });
      } else {
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
      toast.error("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const queryStr = debouncedSearch.toLowerCase();
      const phoneStr = customer.phone?.replace(/\D/g, "") || "";
      const qDigits = queryStr.replace(/\D/g, "");
      
      const matchesSearch = customer.name?.toLowerCase().includes(queryStr) || 
              (qDigits.length > 0 && phoneStr.includes(qDigits)) ||
              customer.email?.toLowerCase().includes(queryStr);
      
      const matchesTier = tierFilter === "all" || customer.loyaltyTier === tierFilter;
      
      return matchesSearch && matchesTier;
    });
  }, [debouncedSearch, customers, tierFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteDoc(doc(db, "customers", id));
      setCustomers(prev => prev.filter(c => c.id !== id));
      logActivity({
        action: "customer.deleted",
        actorId: user?.uid || "system",
        targetId: id,
        targetName: name,
      });
      toast.success(`${name} deleted successfully.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete customer.");
    }
  };

  const handleEdit = (customer: CustomerRecord) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage client relationships, track purchases and identify VIPs.</p>
        </motion.div>
        
        <div className="flex items-center gap-3">
          {role === "Admin" && (
            <motion.button
              onClick={() => exportCustomersCSV(filteredCustomers)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2 text-sm"
            >
              <span>⬇</span> Export CSV
            </motion.button>
          )}
          <motion.button 
            onClick={openAddModal}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="bg-primary text-white px-4 py-2 rounded-lg font-medium shadow-soft hover:shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-5 h-5" />
            Add Customer
          </motion.button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-card p-4 rounded-lg shadow-soft border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-xl w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "Regular", "VIP", "Wholesale"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                tierFilter === t ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "All Tiers" : t}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-soft h-[50vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Loading Customers</h2>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredCustomers.map((customer) => (
              <motion.div
                layout
                key={customer.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.3 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden group flex flex-col relative cursor-pointer"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(customer); }} 
                    className="p-1.5 bg-white text-gray-500 hover:text-primary rounded-md shadow-sm border border-gray-100 hover:border-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {role === "Admin" && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(customer.id, customer.name); }} 
                      className="p-1.5 bg-white text-red-500 hover:text-white hover:bg-red-500 rounded-md shadow-sm border border-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="p-6 flex-1 flex flex-col items-center border-b border-gray-50">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shadow-sm mb-4 transition-colors duration-300">
                    {customer.name?.substring(0, 2).toUpperCase() || "??"}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg text-center">{customer.name}</h3>
                  
                  <div className="flex items-center gap-1.5 text-gray-500 mt-2 text-sm">
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone || "No phone"}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-1.5 text-gray-500 mt-1 text-sm">
                      <Mail className="w-3.5 h-3.5" />
                      {customer.email}
                    </div>
                  )}
                  {customer.lastPurchaseDate && (
                     <p className="text-xs text-gray-400 mt-3">Last seen: {customer.lastPurchaseDate}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50 group-hover:bg-primary/5 transition-colors duration-300 border-t border-gray-100">
                  <div className="p-3 flex flex-col items-center justify-center hover:bg-white transition-colors">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Spent</span>
                    <span className="font-bold text-gray-900 text-sm">
                      ${(customer.totalSpent || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="p-3 flex flex-col items-center justify-center hover:bg-white transition-colors">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Orders</span>
                    <span className="font-bold text-gray-900 text-sm">{customer.totalPurchases || 0}</span>
                  </div>

                  <div className="p-3 flex flex-col items-center justify-center hover:bg-white transition-colors">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Tier</span>
                    <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded-full border ${
                      customer.loyaltyTier === "VIP" 
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200" 
                        : customer.loyaltyTier === "Wholesale"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}>
                       {customer.loyaltyTier || "REG"}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      
      {!loading && filteredCustomers.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 flex flex-col items-center justify-center text-center bg-card rounded-lg border border-gray-100 border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
             {searchQuery ? <Search className="w-8 h-8 text-gray-300" /> : <UserPlus className="w-8 h-8 text-gray-300" />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{searchQuery ? "No matches found" : "No customers yet"}</h3>
          <p className="text-gray-500 max-w-sm mt-1">
             {searchQuery ? `We couldn't find any customers matching "${searchQuery}".` : "Add your first customer to start tracking history."}
          </p>
        </motion.div>
      )}

      {/* Load More */}
      {hasMore && !searchQuery && !loading && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => fetchCustomers(true)}
            disabled={loading}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Load More"}
          </button>
        </div>
      )}

      <AddCustomerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        customer={editingCustomer} 
      />
    </div>
  );
};
