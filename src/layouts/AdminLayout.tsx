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

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="bg-background min-h-screen flex flex-col">
      {!isOnline && (
        <div className="bg-yellow-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2">
           <WifiOff className="w-3.5 h-3.5" />
           You are working offline. Changes will sync when reconnected.
        </div>
      )}
      <div className="flex-1 flex w-full">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col min-h-full">
        <TopNavbar />
        <main className="flex-1 p-8 overflow-x-hidden">
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

