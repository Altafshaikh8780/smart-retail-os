import React, { useState, useEffect, useRef } from "react";
import { Search, Bell, LogOut, Package, User, Check, Loader2, AlertTriangle, ShoppingBag, ArrowRight, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth, logout } from "../lib/auth";
import { useCartStore } from "../store/cartStore";
import { CartDrawer } from "./CartDrawer";
import { collection, query, getDocs, onSnapshot, orderBy, updateDoc, doc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

type SearchResult = {
  id: string;
  type: 'product' | 'customer';
  title: string;
  subtitle: string;
};

type AppNotification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: any;
};

export const TopNavbar: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Cart State
  const [isCartOpen, setIsCartOpen] = useState(false);
  const totalItems = useCartStore((state) => state.getTotalItems());

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Execute Search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearch.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setShowSearchDropdown(true);
      const queryStr = debouncedSearch.toLowerCase();

      try {
        const [productsSnap, customersSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "customers"))
        ]);

        const productResults: SearchResult[] = [];
        productsSnap.forEach(d => {
          const data = d.data();
          if (data.name?.toLowerCase().includes(queryStr) || data.brand?.toLowerCase().includes(queryStr)) {
            productResults.push({ id: d.id, type: 'product', title: data.name, subtitle: `${data.brand || 'Unbranded'} · $${data.price}` });
          }
        });

        const customerResults: SearchResult[] = [];
        customersSnap.forEach(d => {
          const data = d.data();
          if (data.name?.toLowerCase().includes(queryStr) || data.phone?.includes(queryStr) || data.email?.toLowerCase().includes(queryStr)) {
            customerResults.push({ id: d.id, type: 'customer', title: data.name || "Unknown", subtitle: data.phone || data.email || "No contact info" });
          }
        });

        setSearchResults([...productResults.slice(0, 5), ...customerResults.slice(0, 5)]);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearch]);

  // Real-time Notifications Hook
  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const notifs: AppNotification[] = [];
      snap.forEach(d => {
        notifs.push({ id: d.id, ...d.data() } as AppNotification);
      });
      setNotifications(notifs);
    }, (error) => {
      console.error("Notifications listener error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Low Stock Counter
  useEffect(() => {
    // We listen to inventory to find items where current stock <= minStock (or 5)
    // NOTE: In a massive DB, this should be a cloud function updating a counter doc.
    // For this retail OS, a direct listener is fine for real-time reactive UI.
    const unsubscribe = onSnapshot(collection(db, "inventory"), (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data = d.data();
        if (Number(data.stock) <= (Number(data.minStock) || 5)) {
          count++;
        }
      });
      setLowStockCount(count);
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    try {
      await Promise.all(unreadIds.map(id => updateDoc(doc(db, "notifications", id), { read: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'new_order': return <ShoppingBag className="w-4 h-4 text-primary" />;
      case 'return': return <ArrowRight className="w-4 h-4 text-red-500 transform rotate-180" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };
  return (
    <header className="h-16 bg-white shadow-soft flex items-center justify-between px-8 sticky top-0 z-[50]">
      <div className="flex-1 max-w-xl">
        <div ref={searchRef} className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchTerm.trim() && setShowSearchDropdown(true)}
            placeholder="Search products, customers..."
            className="w-full bg-gray-50 border border-gray-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all transition-shadow"
          />
          
          <AnimatePresence>
            {showSearchDropdown && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 py-2"
              >
                {isSearching ? (
                  <div className="flex items-center justify-center py-6 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" />
                    <span className="text-sm font-medium">Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setSearchTerm("");
                          navigate(result.type === 'product' ? `/products/${result.id}` : `/customers`);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                      >
                        <div className={`mt-0.5 p-2 rounded-lg ${result.type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {result.type === 'product' ? <Package className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{result.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{result.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm font-medium text-gray-500">
                    No results found for "{searchTerm}"
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 ml-4">
        {/* Cart Button */}
        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-primary/5"
        >
          <ShoppingCart className="w-5 h-5" />
          {totalItems > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm border-2 border-white">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          )}
        </button>

        {/* Low Stock Quick Navigator */}
        <button 
          onClick={() => navigate('/products')}
          className={`relative p-2 transition-colors rounded-full ${lowStockCount > 0 ? 'text-orange-500 bg-orange-50' : 'text-gray-500 hover:text-primary hover:bg-primary/5'}`}
          title={lowStockCount > 0 ? `${lowStockCount} items low on stock!` : "Inventory healthy"}
        >
          <Package className="w-5 h-5" />
          {lowStockCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm border-2 border-white animate-pulse">
              {lowStockCount > 9 ? '9+' : lowStockCount}
            </span>
          )}
        </button>

        <div ref={notificationsRef} className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 transition-colors rounded-full ${showNotifications ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-primary hover:bg-primary/5'}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col max-h-[400px]"
              >
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                  <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-semibold text-primary hover:text-blue-700 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 p-2">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm font-medium text-gray-500">
                      You're all caught up! 🎉
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-3 rounded-xl mb-1 last:mb-0 transition-colors flex gap-3 group relative ${notif.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                      >
                        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.read ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 pr-6 cursor-default">
                          <p className={`text-sm leading-tight ${!notif.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 font-medium">
                            {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                          </p>
                        </div>
                        
                        {!notif.read && (
                          <button 
                            onClick={() => markAsRead(notif.id)}
                            title="Mark as read"
                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white rounded-full text-blue-500 shadow-sm"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {!notif.read && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary group-hover:opacity-0 transition-opacity" />}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-gray-200 cursor-pointer group">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-gray-700 group-hover:text-primary transition-colors pr-1">
              {user ? user.email?.split('@')[0] : 'Admin'}
            </span>
            <span className="text-xs text-gray-500 pr-1">{role || (user?.email === 'admin@qa.sros' ? 'Admin' : 'Employee')}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-soft group-hover:scale-105 transition-transform uppercase">
            {user?.email ? user.email[0] : 'A'}
          </div>
        </div>

        <button 
          onClick={async () => {
            try {
              await logout();
              toast.success("Logged out successfully");
            } catch (err) {
              toast.error("Failed to logout");
            }
          }}
          className="relative p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 border border-transparent"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  );
};
