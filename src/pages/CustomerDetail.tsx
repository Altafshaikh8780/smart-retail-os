import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Phone, Mail, MapPin, Package, ArrowLeft, Loader2, Calendar, ShoppingBag, CreditCard } from "lucide-react";
import { useSettingsStore } from "../store/settingsStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { StatCard } from "../components/ui/StatCard";
import toast from "react-hot-toast";

export const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const currency = settings.currency || "$";
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setCustomer({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error("Customer not found");
          navigate("/customers");
          return;
        }

        const q = query(
          collection(db, "orders"),
          where("customerId", "==", id)
        );
        const orderSnap = await getDocs(q);
        const orderData: any[] = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort in memory since firestore requires composite index for multiple fields
        orderData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOrders(orderData);
        
      } catch (err) {
        console.error("Error fetching customer data:", err);
        toast.error("Failed to load customer details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="h-full min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading customer insights...</p>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
          <p className="text-sm text-slate-500">Customer ID: {customer.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                  {customer.name.substring(0,2).toUpperCase()}
                </div>
                <Badge variant={customer.loyaltyTier === 'VIP' ? 'warning' : customer.loyaltyTier === 'Wholesale' ? 'info' : 'default'}>
                  {customer.loyaltyTier || 'Standard'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-3 text-slate-700">
                <div className="p-2 bg-slate-100 rounded-lg"><Phone className="w-4 h-4 text-slate-500" /></div>
                <span className="font-medium text-sm">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="p-2 bg-slate-100 rounded-lg"><Mail className="w-4 h-4 text-slate-500" /></div>
                  <span className="font-medium text-sm">{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-3 text-slate-700">
                  <div className="p-2 bg-slate-100 rounded-lg"><MapPin className="w-4 h-4 text-slate-500" /></div>
                  <span className="font-medium text-sm mt-1">{customer.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-slate-700">
                <div className="p-2 bg-slate-100 rounded-lg"><Calendar className="w-4 h-4 text-slate-500" /></div>
                <span className="font-medium text-sm mt-1">Last Seen: {customer.lastPurchaseDate || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard 
              title="Total Spent"
              value={`${currency}${(customer.totalSpent || 0).toLocaleString()}`}
              icon={<CreditCard className="w-6 h-6" />}
              colorClass="text-emerald-700"
              iconBgClass="bg-emerald-100"
            />
            <StatCard 
              title="Total Orders"
              value={customer.totalPurchases || 0}
              icon={<ShoppingBag className="w-6 h-6" />}
              colorClass="text-blue-700"
              iconBgClass="bg-blue-100"
            />
          </div>

          <Card>
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle>Purchase History</CardTitle>
            </CardHeader>
            <div className="p-0">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <Package className="w-12 h-12 mb-3 text-slate-300" />
                  <p>No past purchases found for this customer.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 bg-slate-50/50 uppercase border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Order ID</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Items</th>
                        <th className="px-6 py-4">Total</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-blue-600">
                            <Link to={`/orders?search=${order.orderNumber}`}>{order.orderNumber}</Link>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{order.date}</td>
                          <td className="px-6 py-4 text-slate-600">
                            {order.lineItems?.length || 0} items
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">
                            {currency}{order.total.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="success">{order.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
