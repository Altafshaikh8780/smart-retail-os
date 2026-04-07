import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, orderBy, query, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, CreditCard, Banknote, SmartphoneNfc, Download } from "lucide-react";
import { useSettingsStore } from "../store/settingsStore";
import toast from "react-hot-toast";
import { exportOrdersCSV } from "../lib/csvExport";
import { formatCurrency } from "../lib/validations";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/ui/Badge";

type OrderStatus = "Completed" | "Processing" | "Pending" | "Cancelled" | "Returned";
type PaymentMethod = "UPI" | "Card" | "Cash";

type OrderRecord = {
  id: string;
  orderNumber: string;
  customer: string;
  items: number;
  total: number;
  gst: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  date: string;
  productId?: string;
  productName?: string;
  lineItems?: Array<{ productId: string; name: string; quantity: number; unitPrice: number; costPrice?: number; discount: number; total: number }>;
  cashierId?: string;
  discountAmount?: number;
};



const getBadgeVariant = (status: OrderStatus) => {
  switch (status) {
    case "Completed": return "success";
    case "Processing": return "info";
    case "Pending": return "warning";
    case "Cancelled": return "danger";
    case "Returned": return "warning";
    default: return "default";
  }
};

const getPaymentIcon = (method: PaymentMethod) => {
  switch (method) {
    case "UPI": return <SmartphoneNfc className="w-4 h-4 text-purple-500" />;
    case "Card": return <CreditCard className="w-4 h-4 text-blue-500" />;
    case "Cash": return <Banknote className="w-4 h-4 text-green-500" />;
    default: return null;
  }
};

export const Orders: React.FC = () => {
  const { settings } = useSettingsStore();
  const currency = settings.currency || "$";
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input (150ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const PAGE_SIZE = 15;

  const fetchOrders = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);
      
      let q;
      if (isLoadMore && lastDoc) {
        q = query(
          collection(db, "orders"),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, "orders"),
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

      const data: OrderRecord[] = [];
      snapshot.forEach((doc) => {
          const d = doc.data();
          data.push({
            id: doc.id,
            orderNumber: d.orderNumber || "Unknown",
            customer: d.customer || "Unknown",
            items: d.lineItems ? d.lineItems.reduce((acc: number, item: any) => acc + item.quantity, 0) : (d.items || 1),
            total: d.total || 0,
            gst: d.gst || 0,
            paymentMethod: d.paymentMethod as PaymentMethod || "Card",
            status: d.status as OrderStatus || "Completed",
            date: d.date || "Unknown",
            productId: d.productId,
            productName: d.lineItems && d.lineItems.length > 0 ? d.lineItems[0].name : d.productName,
            lineItems: d.lineItems,
            cashierId: d.cashierId,
            discountAmount: d.discountAmount || 0
          });
        });
        if (isLoadMore) {
          setOrders(prev => {
            const newOrders = data.filter(d => !prev.some(p => p.id === d.id));
            return [...prev, ...newOrders];
          });
        } else {
          setOrders(data);
        }
      } catch (error) {
        console.error("Failed to fetch orders", error);
        toast.error("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const queryStr = debouncedSearch.toLowerCase();
      const matchesSearch = order.orderNumber.toLowerCase().includes(queryStr) || 
             order.customer.toLowerCase().includes(queryStr);
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, orders, statusFilter]);

  const calculateOrderProfit = (order: OrderRecord) => {
    if (!order.lineItems || order.lineItems.length === 0) return 0;
    return order.lineItems.reduce((acc, item) => {
      const unitPrice = Number(item.unitPrice) || 0;
      const costPrice = Number(item.costPrice) || 0; // fallback to 0 if not stored
      const qty = Number(item.quantity) || 1;
      return acc + (unitPrice - costPrice) * qty;
    }, 0);
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
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all store transactions, invoices and customer orders.</p>
        </motion.div>

        <motion.button
          onClick={() => exportOrdersCSV(filteredOrders)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-soft hover:shadow-md transition-all flex items-center gap-2 text-xs"
        >
          <Download className="w-4 h-4" />
          EXPORT CSV
        </motion.button>
      </div>

      {/* 2. Search & Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-card p-4 rounded-lg shadow-soft border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3"
      >
        <div className="relative max-w-lg w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Order ID or Customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {(["all", "Completed", "Pending", "Processing", "Cancelled", "Returned"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as any)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border-2 ${
                statusFilter === s 
                  ? s === "Completed" ? "bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20" :
                    s === "Cancelled" ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20" :
                    s === "Returned" ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" :
                    s === "Pending" ? "bg-yellow-500 text-white border-yellow-500 shadow-lg shadow-yellow-500/20" :
                    "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "ALL" : s.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 3. Orders Table */}
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
                <th className="px-6 py-4 font-semibold">Order ID & Date</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold text-center">Items</th>
                <th className="px-6 py-4 font-semibold">Pricing (Total & GST)</th>
                <th className="px-6 py-4 font-semibold">Payment</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Profit</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait">
              <motion.tbody 
                key={debouncedSearch}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="divide-y divide-gray-100 text-sm"
              >
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono font-medium text-gray-900 group-hover:text-primary transition-colors">
                        <ShoppingCart className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                        {order.orderNumber}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{order.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 font-medium">{order.customer}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-gray-100 text-gray-700 rounded-md font-medium text-xs">
                        {order.items}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 font-bold">{formatCurrency(order.total, currency)}</p>
                      <p className="text-xs text-gray-400 mt-0.5" title="Included GST">GST: {formatCurrency(order.gst, currency)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-medium text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100 w-fit">
                        {getPaymentIcon(order.paymentMethod)}
                        {order.paymentMethod}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getBadgeVariant(order.status) as any}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${calculateOrderProfit(order) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(calculateOrderProfit(order), currency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {order.status === "Completed" ? (
                        <button 
                          onClick={() => navigate('/returns')}
                          className="text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-primary px-3 py-1.5 rounded-lg transition-colors border border-gray-200"
                        >
                          Process Return
                        </button>
                      ) : (
                        <button disabled className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 cursor-not-allowed">
                          Return N/A
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      {loading ? (
                        <div className="space-y-4 max-w-4xl mx-auto">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : (
                        <>
                          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                          <p>No orders found matching "{searchQuery}"</p>
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
          <span>Showing {filteredOrders.length} orders</span>
          {hasMore && !searchQuery && (
            <button
              onClick={() => fetchOrders(true)}
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
