import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { 
  DollarSign, Package, Users, TrendingUp, 
  ArrowUpRight, ArrowDownRight, MoreVertical,
  ShoppingBag, PackagePlus
} from "lucide-react";
import { 
  collection, query, getDocs, limit, orderBy, where, onSnapshot
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/validations";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import toast from "react-hot-toast";
import { Skeleton } from "../components/Skeleton";
import { RestockModal } from "../components/RestockModal";

// Lazy-load charts for better performance
const LazyRevenueChart = lazy(() => import("../components/DashboardCharts").then(m => ({ default: m.RevenueChart })));
const LazyCategoryChart = lazy(() => import("../components/DashboardCharts").then(m => ({ default: m.CategoryChart })));

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const chartVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Metrics Data
  const [statsData, setStatsData] = useState<any[]>([]);
  const [weeklyRevenueData, setWeeklyRevenueData] = useState<any[]>([]);
  const [salesByCategoryData, setSalesByCategoryData] = useState<any[]>([]);
  const [recentOrdersList, setRecentOrdersList] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [secondHandStats, setSecondHandStats] = useState({ revenue: 0, units: 0, sales: 0 });

  // State Management
  const [products, setProducts] = useState<any[]>([]);
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [weekOrders, setWeekOrders] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [restockItem, setRestockItem] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubs: (() => void)[] = [];

    const initialize = async () => {
      try {
        // 1. Fetch Products once for reference
        const pSnap = await getDocs(collection(db, "products"));
        const pList = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (isMounted) setProducts(pList);

        // 2. Setup Real-time Listeners for Orders (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0,0,0,0);

        const qWeek = query(
          collection(db, "orders"),
          where("createdAt", ">=", sevenDaysAgo),
          orderBy("createdAt", "desc")
        );

        const unsubOrders = onSnapshot(qWeek, (snap) => {
          const allWeek = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          if (isMounted) {
            setWeekOrders(allWeek);
            
            // Filter today's orders
            const startOfToday = new Date();
            startOfToday.setHours(0,0,0,0);
            const today = allWeek.filter((o: any) => {
               const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.date);
               return date >= startOfToday;
            });
            setTodayOrders(today);

            // Recent Orders list (top 5)
            const recent = allWeek.slice(0, 5).map((o: any) => ({
              id: o.id.substring(0, 8).toUpperCase(),
              customer: o.customerName || "Walk-in Customer",
              status: o.status || "Completed",
              amount: formatCurrency(o.total || 0),
              date: o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : new Date(o.date).toLocaleDateString()
            }));
            setRecentOrdersList(recent);
            setLoadingStats(false);
          }
        });
        unsubs.push(unsubOrders);

        // 3. Setup Inventory/Low Stock Listener
        const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
          const alerts: any[] = [];
          snap.forEach(doc => {
            const data = doc.data();
            const stock = Number(data.stock) || 0;
            const threshold = Number(data.minStock) || 5;
            if (stock <= threshold) {
              alerts.push({ 
                id: doc.id, 
                productId: data.productId, 
                product: data.product || data.name || "Unknown Product",
                stock,
                limit: threshold
              });
            }
          });
          alerts.sort((a, b) => a.stock - b.stock);
          if (isMounted) {
            setLowStockItems(alerts.slice(0, 5));
            setLoadingAlerts(false);
          }
        });
        unsubs.push(unsubInv);

      } catch (err: any) {
        console.error("Failed to load dashboard data", err);
        if (isMounted) {
          setLoadingStats(false);
          setLoadingAlerts(false);
        }
      }
    };

    initialize();
    return () => {
      isMounted = false;
      unsubs.forEach(u => u());
    };
  }, []);

  // Compute KPI metrics and chart data
  useEffect(() => {
    if (loadingStats) return;

    let todaysRevenue = 0;
    let todaysProfit = 0;
    let shRev = 0;
    let shUnits = 0;
    let shSales = 0;
    const uniqueCustomers = new Set<string>();

    todayOrders.forEach(order => {
      todaysRevenue += Number(order.total) || 0;
      const cName = String(order.customerName || "").trim().toLowerCase();
      if (cName) uniqueCustomers.add(cName);

      if (Array.isArray(order.lineItems)) {
        order.lineItems.forEach((item: any) => {
          const unitPrice = Number(item.unitPrice) || 0;
          const costPrice = Number(item.costPrice) || 0;
          const qty = Number(item.quantity) || 1;
          todaysProfit += (unitPrice - costPrice) * qty;
        });
      }
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        dateStr: d.toISOString().split("T")[0],
        name: d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: 0
      };
    });

    const categoryMap: Record<string, number> = {};
    const productMap: Record<string, { revenue: number; units: number }> = {};

    weekOrders.forEach(order => {
      const orderTotal = Number(order.total) || 0;
      const createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.date);
      const dateStr = createdAt.toISOString().split("T")[0];

      const dayIndex = last7Days.findIndex(d => d.dateStr === dateStr);
      if (dayIndex !== -1) last7Days[dayIndex].revenue += orderTotal;

      if (Array.isArray(order.lineItems) && order.lineItems.length > 0) {
        let hasSH = false;
        order.lineItems.forEach((item: any) => {
          const name = item.name || "Unknown";
          const qty = Number(item.quantity) || 1;
          const rev = (Number(item.unitPrice) || 0) * qty;
          
          // Better category resolution: Check item, then product registry, then fallback
          const productRef = products.find(p => p.id === item.productId);
          const cat = item.category || productRef?.category || "Other";

          categoryMap[cat] = (categoryMap[cat] || 0) + rev;
          
          if (!productMap[name]) productMap[name] = { revenue: 0, units: 0 };
          productMap[name].revenue += rev;
          productMap[name].units += qty;

          if (item.category === "Second-hand" || item.isSecondHand) {
            shRev += rev;
            shUnits += qty;
            hasSH = true;
          }
        });
        if (hasSH) shSales += 1;
      } else {
        // Fallback: If no lineItems, use the primary product data or order data
        const fallbackCat = (order as any).category || (order as any).productCategory || "Other";
        categoryMap[fallbackCat] = (categoryMap[fallbackCat] || 0) + orderTotal;
      }
    });

    const totalStock = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

    setStatsData([
      { title: "Today's Revenue", value: formatCurrency(todaysRevenue), trend: "+0.0%", isPositive: true, icon: DollarSign },
      { title: "Today's Profit",  value: formatCurrency(todaysProfit), trend: todaysProfit >= 0 ? "+" : "-", isPositive: todaysProfit >= 0, icon: TrendingUp },
      { title: "Second-hand (7d)", value: formatCurrency(shRev), trend: `${shUnits} units`, isPositive: true, icon: ShoppingBag },
      { title: "Products in Stock",value: totalStock.toLocaleString(), trend: "Live", isPositive: true, icon: Package },
      { title: "Active Customers", value: uniqueCustomers.size.toLocaleString() || "0", trend: "7-Day", isPositive: true, icon: Users },
    ]);

    setSecondHandStats({ revenue: shRev, units: shUnits, sales: shSales });
    setWeeklyRevenueData(last7Days.map(d => ({ name: d.name, revenue: d.revenue })));

    const pieData = Object.keys(categoryMap)
      .map(k => ({ name: k, value: categoryMap[k] }))
      .filter(x => x.value > 0);
    setSalesByCategoryData(pieData.length > 0 ? pieData : [{ name: "No Sales", value: 1 }]);

    const top = Object.entries(productMap)
      .map(([name, v]) => ({ name, revenue: v.revenue, units: v.units }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    setTopProducts(top);

  }, [todayOrders, weekOrders, products, loadingStats]);

  const handleRestockSuccess = (newStock: number) => {
    setLowStockItems(prev => prev.filter(item => item.id !== restockItem.id || newStock > item.limit));
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Here is the latest overview of your stores.</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4" variants={containerVariants} initial="hidden" animate="show">
        {statsData.map((stat, idx) => (
          <motion.div key={idx} variants={itemVariants} whileHover={{ y: -4 }} className="bg-card p-6 rounded-lg shadow-soft border border-gray-100 flex items-start justify-between group transition-shadow hover:shadow-md cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>
              <div className="flex items-center gap-1 mt-2">
                {stat.isPositive ? <ArrowUpRight className="w-4 h-4 text-green-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                <span className={`text-sm font-medium ${stat.isPositive ? "text-green-500" : "text-red-500"}`}>{stat.trend}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <stat.icon className="w-6 h-6" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-soft border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Weekly Revenue</h3>
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <LazyRevenueChart data={weeklyRevenueData} />
          </Suspense>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-soft border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Sales by Category</h3>
          <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-full" />}>
            <LazyCategoryChart data={salesByCategoryData} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-sm text-primary font-medium hover:underline">View All</button>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {recentOrdersList.map((order, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">{order.id}</td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900 font-medium">{order.customer}</p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-bold">{order.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Low Stock alerts */}
        <div className="bg-card p-6 rounded-lg shadow-soft border border-gray-100">
           <h3 className="text-lg font-bold text-gray-900 mb-6">Inventory Alerts</h3>
           <div className="space-y-4">
              {lowStockItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Package className="w-4 h-4" /></div>
                      <div>
                         <p className="text-sm font-bold text-gray-900">{item.product}</p>
                         <p className="text-xs text-orange-600 font-bold">{item.stock} left (Min: {item.limit})</p>
                      </div>
                   </div>
                   <button onClick={() => setRestockItem(item)} className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:scale-105 transition-transform flex items-center gap-2">
                     <PackagePlus className="w-3.5 h-3.5" /> Restock
                   </button>
                </div>
              ))}
              {lowStockItems.length === 0 && <p className="text-center text-gray-400 py-8">All stock is healthy!</p>}
           </div>
        </div>
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <RestockModal
          isOpen={!!restockItem}
          onClose={() => setRestockItem(null)}
          onSuccess={handleRestockSuccess}
          inventoryId={restockItem.id}
          productId={restockItem.productId}
          productName={restockItem.product}
          currentStock={restockItem.stock}
          minStock={restockItem.limit}
        />
      )}
    </div>
  );
};
