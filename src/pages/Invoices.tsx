import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Download } from "lucide-react";
import { collection, query, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";
import { generateInvoicePDF } from "../lib/pdfGenerator";
import { useSettingsStore } from "../store/settingsStore";
import { exportOrdersCSV } from "../lib/csvExport";

type InvoiceStatus = "Paid" | "Pending" | "Overdue";

type InvoiceRecord = {
  id: string;
  invoiceId: string;
  orderId: string;
  customer: string;
  customerName?: string;
  phone?: string;
  subtotal: number;
  gst: number;
  total: number;
  status: InvoiceStatus;
  date: string;
  lineItems?: Array<{ productId: string; name: string; quantity: number; unitPrice: number; discount: number; total: number; costPrice?: number }>;
  billingAddress?: string;
  dueDate?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  source?: "auto" | "manual";
  createdAt?: any;
};


export const Invoices: React.FC = () => {
  const { settings } = useSettingsStore();
  const currency = settings.currency || "$";
  const [searchQuery, setSearchQuery] = useState("");

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 15;

  const fetchInvoices = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);

      let q;
      if (isLoadMore && lastDoc) {
        q = query(
          collection(db, "invoices"),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, "invoices"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        if (snapshot.docs.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
      } else {
        setHasMore(false);
      }

      const data: InvoiceRecord[] = [];
      snapshot.forEach(d => {
        data.push({ id: d.id, ...d.data() } as InvoiceRecord);
      });

      if (isLoadMore) {
        setInvoices(prev => {
          const newInvoices = data.filter(d => !prev.some(p => p.id === d.id));
          return [...prev, ...newInvoices];
        });
      } else {
        setInvoices(data);
      }
    } catch (error) {
      console.error("Failed to load invoices", error);
      toast.error("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((invoice) => {
      const queryStr = searchQuery.toLowerCase();
      return (invoice.invoiceId && invoice.invoiceId.toLowerCase().includes(queryStr)) || 
             (invoice.customer && invoice.customer.toLowerCase().includes(queryStr));
    });
  }, [searchQuery, invoices]);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">Manage billing, view payment statuses, and download invoice records.</p>
        </motion.div>
        
        <div className="flex items-center gap-3">
          <motion.button 
            onClick={() => exportOrdersCSV(invoices)} // Reuse if applicable or specific
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white border border-gray-200 text-gray-700 flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </motion.button>
        </div>
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
            placeholder="Search by Invoice ID or Customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </motion.div>

      {/* 3. Invoices Table */}
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
                <th className="px-6 py-4 font-semibold">Invoice & Order</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold text-right">Subtotal</th>
                <th className="px-6 py-4 font-semibold text-right">GST</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait">
              <motion.tbody 
                key={searchQuery}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="divide-y divide-gray-100 text-sm flex-1"
              >
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono font-medium text-gray-900 group-hover:text-primary transition-colors">
                        <FileText className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                        {invoice.invoiceId}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Order: {invoice.orderId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 font-medium">{invoice.customer}</p>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {currency}{invoice.subtotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {currency}{invoice.gst.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {currency}{invoice.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors duration-300
                        ${invoice.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 
                          invoice.status === 'Overdue' ? 'bg-red-50 text-red-700 border-red-200' : 
                          'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {invoice.date}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          toast.success(`Generating PDF for ${invoice.invoiceId}...`);
                          generateInvoicePDF(invoice);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors ml-auto mr-0 border border-blue-100 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
                
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      {loading ? (
                        <p>Loading invoices...</p>
                      ) : (
                        <>
                          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                          <p>No invoices found matching "{searchQuery}"</p>
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
          <span>Showing {filteredInvoices.length} invoices</span>
          {hasMore && !searchQuery && (
            <button
              onClick={() => fetchInvoices(true)}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm font-medium"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
