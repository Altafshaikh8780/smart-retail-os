import React from "react";
import { Link, useLocation } from "react-router-dom";
import { usePermissions } from "../hooks/usePermission";
import { PERMISSIONS, hasPermission } from "../lib/permissions";
import { motion } from "framer-motion";
import { useSettingsStore } from "../store/settingsStore";
import { useAuth } from "../lib/auth";
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  Smartphone, 
  ShoppingCart, 
  Users, 
  UserSquare2, 
  Undo2, 
  FileText, 
  BarChart3, 
  BrainCircuit, 
  Settings,
  RotateCcw,
  X
} from "lucide-react";

type NavItem = {
  name: string;
  path: string;
  icon: React.ElementType;
  permission?: string; // undefined = always visible
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "MAIN",
    items: [
      { name: "Dashboard", path: "/", icon: LayoutDashboard },
      { name: "Products",  path: "/products",      icon: Package,       permission: PERMISSIONS.VIEW_PRODUCTS  },
      { name: "Inventory", path: "/inventory",     icon: Boxes,         permission: PERMISSIONS.VIEW_INVENTORY },
      { name: "IMEI Tracking", path: "/imei-tracking", icon: Smartphone, permission: PERMISSIONS.VIEW_IMEI    },
      { name: "Second-hand", path: "/second-hand", icon: RotateCcw, permission: PERMISSIONS.VIEW_PRODUCTS },
      { name: "Orders",    path: "/orders",        icon: ShoppingCart,  permission: PERMISSIONS.VIEW_ORDERS   },
    ]
  },
  {
    title: "MANAGEMENT",
    items: [
      { name: "Customers", path: "/customers",  icon: Users,       permission: PERMISSIONS.VIEW_CUSTOMERS  },
      { name: "Employees", path: "/employees",  icon: UserSquare2, permission: PERMISSIONS.VIEW_EMPLOYEES  },
      { name: "Returns",   path: "/returns",    icon: Undo2,       permission: PERMISSIONS.VIEW_RETURNS    },
      { name: "Invoices",  path: "/invoices",   icon: FileText,    permission: PERMISSIONS.VIEW_INVOICES   },
    ]
  },
  {
    title: "INSIGHTS",
    items: [
      { name: "Analytics",   path: "/analytics",   icon: BarChart3,    permission: PERMISSIONS.VIEW_ANALYTICS  },
      { name: "Restock AI",  path: "/restock-ai",  icon: BrainCircuit, permission: PERMISSIONS.VIEW_RESTOCK_AI },
    ]
  }
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { role } = useAuth();
  const permissions = usePermissions();
  const { settings } = useSettingsStore();

  const canSeeSettings = role === "Admin" || hasPermission(permissions, PERMISSIONS.VIEW_SETTINGS);

  // Filter items the current user has permission to see
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || hasPermission(permissions, item.permission as any)
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className={`fixed left-0 top-0 h-screen w-64 bg-sidebar text-slate-300 flex flex-col pt-6 z-[60] transition-transform duration-300 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
      
      {/* Mobile Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-5 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="px-6 mb-8 mt-4">
        <h1 className="text-xl font-bold text-white tracking-wide truncate" title={settings.storeName}>
          {settings.storeName || "Smart Retail OS"}
        </h1>
        {role && (
          <span className="mt-1 inline-block text-xs font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
            {role}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-6 pb-4">
        {visibleSections.map((section, idx) => (
          <div key={idx}>
            <p className="text-xs font-semibold text-slate-500 mb-2 px-2 uppercase tracking-wider">
              {section.title}
            </p>
            <nav className="space-y-1">
              {section.items.map((item) => {
                let isActive = location.pathname === item.path || 
                  (item.path !== "/" && location.pathname.startsWith(item.path));
                
                // Highlight Inventory (and unhighlight Products) when on Product Detail page
                const isProductDetail = location.pathname.match(/^\/products\/.+/);
                if (isProductDetail) {
                  if (item.name === "Inventory") isActive = true;
                  if (item.name === "Products") isActive = false;
                }
                
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg relative transition-colors text-sm font-medium hover:text-white group"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-sidebar-nav"
                        className="absolute inset-0 bg-primary/20 rounded-lg text-primary"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-5 h-5 relative z-10 ${isActive ? "text-primary" : "text-slate-400 group-hover:text-primary transition-colors"}`} />
                    <span className={`relative z-10 ${isActive ? "text-white" : ""}`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-4 mt-auto border-t border-slate-700/50 space-y-4">
        {canSeeSettings && (
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg relative transition-colors text-sm font-medium hover:text-white group"
          >
            {location.pathname === "/settings" && (
              <motion.div
                layoutId="active-sidebar-nav"
                className="absolute inset-0 bg-primary/20 rounded-lg"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Settings className={`w-5 h-5 relative z-10 ${location.pathname === "/settings" ? "text-primary" : "text-slate-400 group-hover:text-primary transition-colors"}`} />
            <span className={`relative z-10 ${location.pathname === "/settings" ? "text-white" : ""}`}>
              Settings
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
};
