import React from "react";
import { Sidebar } from "../components/Sidebar";
import { TopNavbar } from "../components/TopNavbar";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { WifiOff } from "lucide-react";

import { useSettingsStore } from "../store/settingsStore";

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { isOnline } = useNetworkStatus();
  const fetchSettings = useSettingsStore(state => state.fetchSettings);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Close sidebar on route change (mobile)
  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="bg-background min-h-screen flex flex-col">
      {!isOnline && (
        <div className="bg-yellow-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2">
           <WifiOff className="w-3.5 h-3.5" />
           You are working offline. Changes will sync when reconnected.
        </div>
      )}
      <div className="flex-1 flex w-full relative">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[15] lg:hidden backdrop-blur-sm"
            />
          )}
        </AnimatePresence>

        <div className="flex-1 lg:ml-64 flex flex-col min-h-full w-full transition-all duration-300">
        <TopNavbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3500,
            className: "shadow-soft rounded-lg text-sm border border-gray-100",
            style: {
              background: "#ffffff",
              color: "#111827",
              padding: "12px 16px",
            },
            success: {
              iconTheme: { primary: "#22c55e", secondary: "#fff" },
            },
          }} 
        />
      </div>
    </div>
  );
};

