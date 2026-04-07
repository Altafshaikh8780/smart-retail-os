import React from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string; // e.g., 'bg-blue-500 text-white' or 'text-blue-500 bg-blue-100'
  iconBgClass?: string;
}

export const StatCard = React.memo(({ title, value, icon, colorClass, iconBgClass }: StatCardProps) => {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 transition-shadow hover:shadow-md"
    >
      <div className={`p-3 w-14 h-14 rounded-xl flex items-center justify-center ${iconBgClass || colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
      </div>
    </motion.div>
  );
});

StatCard.displayName = "StatCard";
