import React, { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { DollarSign, ShoppingBag, Package, Users, ArrowUpRight, ArrowDownRight, MoreVertical, PackagePlus, TrendingUp } from "lucide-react";
import { collection, getDocs, onSnapshot, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";
import { Skeleton } from "../components/Skeleton";
import { RestockModal } from "../components/RestockModal";
import { useSettingsStore } from "../store/settingsStore";

const LazyRevenueChart = lazy(() => import("../components/DashboardCharts").then(m => ({ default: m.RevenueChart })));
const LazyCategoryChart = lazy(() => import("../components/DashboardCharts").then(m => ({ default: m.CategoryChart })));

// --- Animation Variants ---
// --- Animation Variants ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const chartVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

export const Dashboard: React.FC = () => {
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [restockItem, setRestockItem] = useState<any | null>(null);

  const { settings } = useSettingsStore();
  const currency = settings.currency || "$";
  const navigate = useNavigate();

  const [secondHandStats, setSecondHandStats] = useState({ revenue: 0, units: 0, sales: 0 });

  // Separate states for today's KPIs and chart data
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [weekOrders, setWeekOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Dynamic States
  const [statsData, setStatsData] = useState<any[]>([
    { title: "Today's Revenue", value: `$0.00`, trend: "-", isPositive: true, icon: DollarSign },
    { title: "Today's Profit",  value: `$0.00`, trend: "-", isPositive: true, icon: TrendingUp },
    { title: "Orders Today", value: "0", trend: "-", isPositive: true, icon: ShoppingBag },
    { title: "Products in Stock", value: "0", trend: "-", isPositive: true, icon: Package },
    { title: "Active Customers", value: "0", trend: "-", isPositive: true, icon: Users },
  ]);
  const [weeklyRevenueData, setWeeklyRevenueData] = useState<any[]>([]);
  const [salesByCategoryData, setSalesByCategoryData] = useState<any[]>([]);
  const [recentOrdersList, setRecentOrdersList] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; units: number }[]>([]);

  // Hybrid Data Fetching
  useEffect(() => {
    let isMounted = true;
    let unsubs: (() => void)[] = [];

    const initialize = async () => {
      try {
        setLoadingStats(true);

        // --- Bounded date calculations ---
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOf7DaysAgo = new Date(startOfToday);
        startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 6);
        const todayTs = Timestamp.fromDate(startOfToday);
        const weekTs = Timestamp.fromDate(startOf7DaysAgo);

        // Query 1: Today's orders only (small, bounded)
        const todayOrdersQ = query(
          collection(db, "orders"),
          where("createdAt", ">=", todayTs),
          orderBy("createdAt", "desc")
        );

        // Query 2: Last 7 days for weekly chart
        const weekOrdersQ = query(
          collection(db, "orders"),
          where("createdAt", ">=", weekTs),
          orderBy("createdAt", "desc"),
          limit(500)
        );

        // Query 3: Products (limited – only need for stock count & categories)
        const productsQ = query(collection(db, "products"), limit(500));

        // Query 4: Recent orders for the table (capped at 8)
        const recentOrdersQ = query(
          collection(db, "orders"),
          orderBy("createdAt", "desc"),
          limit(8)
        );

        const [todaySnap, weekSnap, pSnap, recentSnap] = await Promise.all([
          getDocs(todayOrdersQ),
          getDocs(weekOrdersQ),
          getDocs(productsQ),
          getDocs(recentOrdersQ)
        ]);

        if (!isMounted) return;

        setTodayOrders(todaySnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setWeekOrders(weekSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Recent orders list – immediate, no secondary effect needed
        const recent = recentSnap.docs.map(d => {
          const o = d.data();
          return {
            id: o.orderNumber || d.id.slice(0, 8).toUpperCase(),
            customer: o.customer || o.customerName || "Unknown",
            amount: `${currency}${(Number(o.total) || 0).toFixed(2)}`,
            status: o.status || "Completed",
            date: o.createdAt?.toDate
              ? o.createdAt.toDate().toLocaleString([], { dateStyle: "short", timeStyle: "short" })
              : (o.date || "—")
          };
        });
        setRecentOrdersList(recent);
        setLoadingStats(false);

        // Real-time low-stock alerts from products collection (source of truth)
        const unsubInv = onSnapshot(collection(db, "products"), (snap) => {
          const alerts: any[] = [];
          snap.forEach((doc) => {
            const data = doc.data();
            if (data.category === "Second-hand") return; // Usually don't restock SH

            const stock = Number(data.stock) || 0;
            const threshold = Number(data.minStock) || Number(data.lowStockThreshold) || 5; // fallback to 5

            if (stock <= threshold) {
              alerts.push({
                id: doc.id, // for products navigation
                productId: doc.id, 
                product: data.name || "Unknown Product",
                stock,
                limit: threshold
              });
            }
          });
          alerts.sort((a, b) => a.stock - b.stock);
          setLowStockItems(alerts.slice(0, 5));
          setLoadingAlerts(false);
        });

        if (isMounted) {
          unsubs.push(unsubInv);
        } else {
          unsubInv();
        }
      } catch (err: any) {
        console.error("Failed to load dashboard data", err);
        toast.error("Failed to load dashboard data.");
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

  // Compute KPI metrics from bounded today/week data
  useEffect(() => {
    if (loadingStats) return;

    let todaysRevenue = 0;
    let todaysOrders = 0;
    let todaysProfit = 0;
    let shRev = 0;
    let shUnits = 0;
    let shSales = 0;
    const uniqueCustomers = new Set<string>();

    // Today's KPIs — use lineItems for accurate profit
    todayOrders.forEach(order => {
      todaysRevenue += Number(order.total) || 0;
      todaysOrders += 1;
      const cName = String(order.customer || order.customerName || "").trim().toLowerCase();
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

    // Weekly stats
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
      const cName = String(order.customer || order.customerName || "").trim().toLowerCase();
      if (cName) uniqueCustomers.add(cName);

      let orderDateObj: Date;
      if (order.createdAt?.toDate) {
        orderDateObj = order.createdAt.toDate();
      } else {
        orderDateObj = new Date(order.date || Date.now());
      }
      const orderDateStr = orderDateObj.toISOString().split("T")[0];
      const orderTotal = Number(order.total) || 0;

      const dayIndex = last7Days.findIndex(d => d.dateStr === orderDateStr);
      if (dayIndex !== -1) last7Days[dayIndex].revenue += orderTotal;

      const catalogProduct = products.find(p => p.id === order.productId);
      const mainCategory = catalogProduct?.category || "Uncategorized";
      categoryMap[mainCategory] = (categoryMap[mainCategory] || 0) + orderTotal;

      if (Array.isArray(order.lineItems)) {
        let hasSH = false;
        order.lineItems.forEach((item: any) => {
          const name = item.name || "Unknown";
          const qty = Number(item.quantity) || 1;
          const rev = (Number(item.unitPrice) || 0) * qty;
          
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
      }
    });

    const totalStock = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

    setStatsData([
      { title: "Today's Revenue", value: `${currency}${todaysRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, trend: "+0.0%", isPositive: true, icon: DollarSign },
      { title: "Today's Profit",  value: `${currency}${todaysProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, trend: todaysProfit >= 0 ? "+" : "-", isPositive: todaysProfit >= 0, icon: TrendingUp },
      { title: "Second-hand (7d)", value: `${currency}${shRev.toLocaleString()}`, trend: `${shUnits} units`, isPositive: true, icon: ShoppingBag },
      { title: "Products in Stock",value: totalStock.toLocaleString(), trend: "Live", isPositive: true, icon: Package },
      { title: "Active Customers", value: uniqueCustomers.size.toLocaleString(), trend: "7-Day", isPositive: true, icon: Users },
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

  }, [todayOrders, weekOrders, products, loadingStats, currency]);

  const handleRestockSuccess = (newStock: number) => {
    // Update UI instantly
    setLowStockItems(prev => {
      const updated = prev.map(item => 
        item.id === restockItem.id ? { ...item, stock: newStock } : item
      );
      // Re-sort and re-slice dynamically
      const filtered = updated.filter(item => item.stock <= item.limit);
      return filtered.sort((a, b) => a.stock - b.stock).slice(0, 5);
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Here is the latest overview of your stores.</p>
      </motion.div>

      {/* 2. Stats Cards (5) */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {statsData.map((stat, idx) => (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="bg-card p-6 rounded-lg shadow-soft border border-gray-100 flex items-start justify-between group transition-shadow hover:shadow-md cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>
              <div className="flex items-center gap-1 mt-2">
                {stat.isPositive ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${stat.isPositive ? "text-green-500" : "text-red-500"}`}>
                  {stat.trend}
                </span>
                <span className="text-xs text-gray-400 ml-1">vs last week</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <stat.icon className="w-6 h-6" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* 3. Charts */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Weekly Revenue Bar Chart */}
        <motion.div variants={chartVariants} className="bg-card p-6 rounded-lg shadow-soft border border-gray-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Weekly Revenue</h3>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          <div className="h-[300px] w-full">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <LazyRevenueChart data={weeklyRevenueData} currency={currency} />
            </Suspense>
          </div>
        </motion.div>

        {/* Sales by Category Donut Chart */}
        <motion.div variants={chartVariants} className="bg-card p-6 rounded-lg shadow-soft border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Sales by Category</h3>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          <div className="h-[300px] w-full">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-full" />}>
              <LazyCategoryChart data={salesByCategoryData} currency={currency} />
            </Suspense>
          </div>
        </motion.div>
      </motion.div>

      {/* 4. Sections */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
      >
        {/* Recent Orders */}
        <motion.div variants={itemVariants} className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-sm text-primary hover:text-blue-700 font-medium transition-colors">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">Order ID</th>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {recentOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                      No recent orders found.
                    </td>
                  </tr>
                ) : (
                  recentOrdersList.map((order, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">{order.id}</td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 font-medium">{order.customer}</p>
                      <p className="text-xs text-gray-500">{order.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${order.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                          order.status === 'Processing' ? 'bg-blue-100 text-blue-800' : 
                          'bg-yellow-100 text-yellow-800'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{order.amount}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Low Stock Alerts */}
        <motion.div variants={itemVariants} className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Low Stock Alerts</h3>
            <div className="text-sm text-gray-400 font-medium transition-colors flex items-center gap-1">
              Live updates
            </div>
          </div>
          <div className="p-6 space-y-4 flex-1">
            {loadingAlerts ? (
              <div className="space-y-4 pt-2">
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-8 bg-green-50/50 rounded-xl border border-green-100">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                  <Package className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-green-700">All stock levels look healthy!</p>
              </div>
            ) : (
              lowStockItems.map((alert, idx) => {
                const threshold = alert.limit || 5;
                const stockPercentage = Math.min((alert.stock / threshold) * 100, 100);
                const isCritical = alert.stock <= 0;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => navigate(`/products/${alert.productId}`)}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all border cursor-pointer hover:shadow-soft active:scale-[0.98] ${isCritical ? 'border-red-200 bg-red-50/20' : 'border-yellow-200 bg-yellow-50/20 hover:bg-yellow-50/40'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${isCritical ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{alert.product}</p>
                        <p className={`text-[10px] uppercase font-bold tracking-tight ${isCritical ? 'text-red-500' : 'text-yellow-600'}`}>
                          {isCritical ? 'STOCK OUT' : `CRITICAL: ${alert.stock} UNITS LEFT`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Threshold</p>
                        <p className="text-xs font-bold text-slate-600">{threshold}</p>
                      </div>
                      <div className="w-24 hidden lg:block">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : 'bg-yellow-500'}`} 
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRestockItem(alert); }}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <PackagePlus className="w-3.5 h-3.5 text-primary" />
                        Restock
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* 5. Top Products (7-day) */}
      {topProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Top Products <span className="text-sm font-normal text-gray-400 ml-1">(last 7 days)</span></h3>
          </div>
          <div className="divide-y divide-gray-50">
            {topProducts.map((product, idx) => {
              const maxRev = topProducts[0].revenue || 1;
              const pct = (product.revenue / maxRev) * 100;
              return (
                <div key={idx} className="px-6 py-4 flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-400 w-5 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{currency}{product.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">{product.units} units</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      
      {/* 6. Second-Hand Market Analytics Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden mt-6"
      >
        <div className="p-6 border-b border-gray-100 bg-violet-50/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Second-Hand Market Insights <span className="text-sm font-normal text-gray-400 ml-1">(last 7 days)</span></h3>
          </div>
          <button onClick={() => navigate("/second-hand")} className="text-sm font-bold text-violet-600 hover:text-violet-700 transition-colors bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100 shadow-sm">
            Manage Inventory
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <div className="p-8 flex items-center justify-center gap-4 group hover:bg-gray-50/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform shadow-sm">
               <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Units Sold</p>
              <h4 className="text-2xl font-bold text-gray-900">{secondHandStats.units} units</h4>
            </div>
          </div>
          
          <div className="p-8 flex items-center justify-center gap-4 group hover:bg-gray-50/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform shadow-sm">
               <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Net Revenue</p>
              <h4 className="text-2xl font-bold text-green-600">{currency}{secondHandStats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
            </div>
          </div>
          
          <div className="p-8 flex items-center justify-center gap-4 group hover:bg-gray-50/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-sm">
               <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Transactions</p>
              <h4 className="text-2xl font-bold text-blue-600">{secondHandStats.sales} orders</h4>
            </div>
          </div>
        </div>
      </motion.div>

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
