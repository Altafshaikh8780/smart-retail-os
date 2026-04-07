import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Smartphone, ShieldCheck, Calendar } from "lucide-react";

// --- Mock Data ---
type IMEIStatus = "In Stock" | "Sold" | "Returned";

type IMEIRecord = {
  id: string;
  imei: string;
  product: string;
  status: IMEIStatus;
  warrantyExpiry: string;
  purchaseDate: string;
  customerName?: string;
};



export const IMEITracking: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [records, setRecords] = useState<IMEIRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"All" | "In Stock" | "Sold" | "Returned">("All");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, "device_serials"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const data: IMEIRecord[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          data.push({
            id: doc.id,
            imei: d.imei || "Unknown",
            product: d.productName || "Unknown Product",
            status: d.status as IMEIStatus || "Sold",
            warrantyExpiry: d.warrantyExpiry || "N/A",
            purchaseDate: d.purchaseDate || "N/A",
            customerName: d.customerName
          });
        });
        setRecords(data);
      } catch (error) {
        console.error("Failed to fetch IMEI records", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchSearch = record.imei.includes(searchQuery) || 
                          record.product.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "All" || record.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [searchQuery, records, statusFilter]);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">IMEI Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">Trace lifecycle, warranty, and status of individualized products.</p>
        </motion.div>
      </div>

      {/* 2. Search & Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-card p-4 rounded-lg shadow-soft border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="relative max-w-lg w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by IMEI number or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {(["All", "In Stock", "Sold", "Returned"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border-2 ${
                statusFilter === status 
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                  : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 3. IMEI Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden"
      >
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-semibold">IMEI / Serial</th>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Warranty Expiry</th>
                <th className="px-6 py-4 font-semibold">Purchase Date</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait">
              <motion.tbody 
                key={searchQuery} // Re-animate on search filter changes
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="divide-y divide-gray-100 text-sm"
              >
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4 font-mono font-medium text-gray-900 group-hover:text-primary transition-colors flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-gray-400" />
                      {record.imei}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {record.product}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors duration-300
                        ${record.status === 'In Stock' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
                          record.status === 'Sold' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 
                          'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                      >
                        {record.status}
                      </span>
                      {record.customerName && (
                         <p className="text-xs text-gray-400 mt-1 max-w-[120px] truncate" title={record.customerName}>
                           To: {record.customerName}
                         </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <ShieldCheck className="w-4 h-4" />
                        {record.warrantyExpiry}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {record.purchaseDate}
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {loading ? (
                        <p>Loading records...</p>
                      ) : (
                        <>
                          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                          <p>No records found matching "{searchQuery}"</p>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </motion.tbody>
            </AnimatePresence>
          </table>
        </div>
        
        {/* Pagination Details */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 bg-gray-50/50">
          <span>Showing {filteredRecords.length} records</span>
        </div>
      </motion.div>
    </div>
  );
};
