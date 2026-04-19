import React, { useState, useEffect, useMemo } from "react";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  DollarSign, ShoppingBag, Users, TrendingUp, Filter, 
  Loader2, RefreshCw, BarChart3, PieChart as PieChartIcon
} from "lucide-react";
import { Card, CardContent, CardTitle } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useAuth } from "../lib/auth";
import { formatCurrency } from "../lib/validations";
import { SalesTrendChart, TopProductsChart } from "../components/DashboardCharts";

export const Analytics: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === "Admin";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    orders: [] as any[],
    customers: [] as any[],
    products: [] as any[]
  });

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        // Fetch last 30 days of orders for trend analysis
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const [ordersSnap, customersSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(db, "orders"), where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)), orderBy("createdAt", "desc"))),
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "products"))
        ]);

        setData({
          orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          customers: customersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });
      } catch (err) {
        console.error("[Analytics] Data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Aggregated Metrics
  const metrics = useMemo(() => {
    const totalRev = data.orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const totalOrders = data.orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRev / totalOrders : 0;
    
    // Profit & Second-Hand Stats
    let totalProfit = 0;
    let shRevenue = 0;
    let shProfit = 0;
    let shCount = 0;

    data.orders.forEach(order => {
      const isSH = order.isSecondHand || (Array.isArray(order.lineItems) && order.lineItems.some((i: any) => i.isSecondHand));
      if (isSH) {
        shRevenue += Number(order.total) || 0;
        shCount++;
      }

      if (Array.isArray(order.lineItems)) {
        order.lineItems.forEach((item: any) => {
          const rev = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
          const cost = (Number(item.costPrice) || 0) * (Number(item.quantity) || 1);
          const profit = rev - cost;
          totalProfit += profit;
          if (item.isSecondHand || isSH) shProfit += profit;
        });
      }
    });

    return { totalRev, totalOrders, avgOrderValue, totalProfit, shRevenue, shProfit, shCount };
  }, [data]);

  // Chart Data Preparation
  const salesTrend = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    data.orders.forEach(o => {
      const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
      dailyMap[date] = (dailyMap[date] || 0) + (Number(o.total) || 0);
    });
    return Object.keys(dailyMap).map(date => ({ date, sales: dailyMap[date] })).reverse();
  }, [data.orders]);

  const topSellingProducts = useMemo(() => {
    const pMap: Record<string, number> = {};
    data.orders.forEach(o => {
      if (Array.isArray(o.lineItems)) {
        o.lineItems.forEach((i: any) => {
          pMap[i.name] = (pMap[i.name] || 0) + (Number(i.unitPrice) * Number(i.quantity));
        });
      }
    });
    return Object.entries(pMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [data.orders]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Analyzing store performance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intelligence Dashboard</h1>
          <p className="text-sm text-gray-500">Comprehensive analytics for last 30 days of operations.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-soft text-xs font-bold text-gray-400">
          <Filter className="w-3.5 h-3.5" /> 30D RANGE
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Revenue (30D)" value={formatCurrency(metrics.totalRev)} icon={<DollarSign className="w-6 h-6" />} colorClass="text-blue-600 bg-blue-50" />
        {isAdmin && (
          <StatCard title="Gross Profit" value={formatCurrency(metrics.totalProfit)} icon={<TrendingUp className="w-6 h-6" />} colorClass="text-emerald-600 bg-emerald-50" />
        )}
        <StatCard title="Order Volume" value={metrics.totalOrders.toString()} icon={<ShoppingBag className="w-6 h-6" />} colorClass="text-purple-600 bg-purple-50" />
        <StatCard title="Avg. Ticket" value={formatCurrency(metrics.avgOrderValue)} icon={<BarChart3 className="w-6 h-6" />} colorClass="text-orange-600 bg-orange-50" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
               <CardTitle>Revenue Trend</CardTitle>
               <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">DAILY VOLUME</span>
            </div>
            <SalesTrendChart data={salesTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
               <CardTitle>Top Revenue Drivers</CardTitle>
               <PieChartIcon className="w-4 h-4 text-violet-400" />
            </div>
            <TopProductsChart data={topSellingProducts} />
          </CardContent>
        </Card>
      </div>

      {/* Specialized Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent>
            <CardTitle className="mb-6">Second-Hand Market Performance</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 italic">
                <div className="flex items-center gap-2 text-violet-600 mb-2">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Volume</span>
                </div>
                <p className="text-2xl font-black text-gray-900">{metrics.shCount}</p>
                <p className="text-[10px] text-gray-500 mt-1">Units resold this month</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                   <DollarSign className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Revenue</span>
                </div>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(metrics.shRevenue)}</p>
                <p className="text-[10px] text-gray-500 mt-1">Total SH sales turnover</p>
              </div>
              {isAdmin && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">SH Profit</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700">{formatCurrency(metrics.shProfit)}</p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">Margin: {metrics.shRevenue > 0 ? ((metrics.shProfit/metrics.shRevenue)*100).toFixed(1) : 0}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <CardTitle className="mb-6">Customer Base</CardTitle>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{data.customers.length}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Registered</p>
                  </div>
                </div>
                <Users className="w-8 h-8 text-gray-50 opacity-10" />
              </div>
              <div className="pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 font-medium">Capture rate: <span className="text-gray-900 font-bold">84%</span></p>
                <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-orange-400 w-[84%] rounded-full" />
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

