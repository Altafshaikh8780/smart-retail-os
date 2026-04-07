import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, RotateCcw, Box, User, AlertCircle, CheckCircle, Clock, Plus, ChevronDown, Eye, FileText, Trash2 } from "lucide-react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";
import { Skeleton } from "../components/Skeleton";
import { InitiateReturnModal } from "../components/InitiateReturnModal";
import { generateReturnPDF } from "../lib/pdfGenerator";
import { deleteReturnRecord } from "../lib/returnService";
import { useSettingsStore } from "../store/settingsStore";
import { useNavigate } from "react-router-dom";

type ReturnStatus = "Pending" | "Approved" | "Rejected" | "Processed";

type ReturnRecord = {
  id: string;
  returnId: string;
  orderId: string;
  customer: string;
  product: string;
  reason: string;
  refundAmount: number;
  status: ReturnStatus;
  date: string;
};

const getStatusStyles = (status: ReturnStatus) => {
  switch (status) {
    case "Processed": return "bg-green-50 text-green-700 border-green-200 hover:bg-green-100";
    case "Approved": return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
    case "Pending": return "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100";
    case "Rejected": return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

const getStatusIcon = (status: ReturnStatus) => {
  switch (status) {
    case "Processed": return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case "Approved": return <CheckCircle className="w-3.5 h-3.5 text-blue-500" />;
    case "Pending": return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    case "Rejected": return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    default: return null;
  }
};

// --- Action Dropdown Sub-component ---
interface DropdownProps {
  ret: ReturnRecord;
  onDelete: (id: string) => void;
  onDownload: (ret: ReturnRecord) => void;
}

const ReturnActionDropdown: React.FC<DropdownProps> = ({ ret, onDelete, onDownload }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload(ret);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(ret.id);
    setIsOpen(false);
  };

  const handleViewOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/orders?search=${ret.orderId}`);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
          isOpen 
            ? "bg-primary text-white border-primary shadow-md scale-105" 
            : "text-gray-600 bg-white border-gray-200 hover:border-primary/50 hover:bg-blue-50"
        }`}
      >
        Options
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="py-1">
                <button
                  onClick={handleViewOrder}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors text-left"
                >
                  <Eye className="w-4 h-4 text-blue-500" />
                  View Details
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-green-500" />
                  Download Receipt
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left font-semibold"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Delete Record
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Returns: React.FC = () => {
  const { settings } = useSettingsStore();
  const currency = settings.currency || "$";
  const [searchQuery, setSearchQuery] = useState("");
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    const q = query(
      collection(db, "returns"),
      orderBy("createdAt", "desc"),
      limit(150)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: ReturnRecord[] = [];
      snap.forEach(d => {
         data.push({ id: d.id, ...d.data() } as ReturnRecord);
      });
      setReturns(data);
      setLoading(false);
    }, (error) => {
      console.error("Failed to load returns", error);
      toast.error("Failed to load returns.");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      const queryStr = searchQuery.toLowerCase();
      return (ret.returnId && ret.returnId.toLowerCase().includes(queryStr)) || 
             (ret.orderId && ret.orderId.toLowerCase().includes(queryStr)) ||
             (ret.customer && ret.customer.toLowerCase().includes(queryStr));
    });
  }, [searchQuery, returns]);

  const handleDeleteReturn = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this return record?")) return;
    
    const toastId = toast.loading("Removing record...");
    try {
      await deleteReturnRecord(id);
      setReturns(prev => prev.filter(r => r.id !== id));
      toast.success("Return record purged", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Deletion failed", { id: toastId });
    }
  };

  const handleDownloadReceipt = (ret: ReturnRecord) => {
    try {
      toast.loading("Generating Credit Note...", { duration: 2000 });
      generateReturnPDF({
        returnId: ret.returnId,
        orderId: ret.orderId,
        customer: ret.customer,
        date: ret.date,
        reason: ret.reason || "Manual Return",
        refundAmount: ret.refundAmount,
        refundMethod: (ret as any).refundMethod || "Card",
        product: ret.product
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">Returns Management</h1>
          <p className="text-gray-500 text-sm mt-1">Review, approve, and process customer returns and refund requests.</p>
        </motion.div>
        
        <motion.button 
          onClick={() => setIsModalOpen(true)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-primary text-white flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold shadow-soft hover:shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-5 h-5 border border-white/30 rounded-full p-0.5" />
          Initiate Return
        </motion.button>
      </div>

      {/* 2. Search & Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-card p-4 rounded-lg shadow-soft border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="relative max-w-xl w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Return ID, Order ID, or Customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </motion.div>

      {/* 3. Returns Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden"
      >
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-semibold">Return & Order ID</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold text-right">Refund Amount</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait">
              <motion.tbody 
                key={searchQuery}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="divide-y divide-gray-100 text-sm"
              >
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono font-medium text-gray-900 group-hover:text-primary transition-colors">
                        <RotateCcw className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                        {ret.returnId}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 max-w-[150px] truncate" title={ret.orderId}>
                        Order: {ret.orderId}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-900 font-medium">
                        <User className="w-4 h-4 text-gray-400" />
                        {ret.customer}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Box className="w-4 h-4 text-gray-400" />
                        {ret.product}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={ret.reason}>
                      {ret.reason}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-gray-900">{currency}{ret.refundAmount.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors duration-300 ${getStatusStyles(ret.status)}`}>
                        {getStatusIcon(ret.status)}
                        {ret.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ReturnActionDropdown 
                        ret={ret} 
                        onDelete={handleDeleteReturn} 
                        onDownload={handleDownloadReceipt}
                      />
                    </td>
                  </tr>
                ))}
                
                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      {loading ? (
                        <div className="space-y-4 max-w-4xl mx-auto">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : (
                        <>
                          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                          <p>No returns found matching "{searchQuery}"</p>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </motion.tbody>
            </AnimatePresence>
          </table>
        </div>
        
        {/* Pagination mock */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 bg-gray-50/50">
          <span>{loading ? 'Synchronizing Returns...' : `Showing ${filteredReturns.length} returns`}</span>
        </div>
      </motion.div>

      <InitiateReturnModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
