import React from "react";
import { motion } from "framer-motion";

export const PageLoader: React.FC = () => {
  return (
    <div className="w-full h-[80vh] flex flex-col items-center justify-center p-8 space-y-8">
      {/* Header Skeleton */}
      <div className="w-full flex justify-between items-center max-w-7xl mx-auto">
        <div className="space-y-3 w-1/3">
          <div className="h-8 bg-gray-200 rounded-md animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded-md animate-pulse w-1/2"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-32"></div>
      </div>
      
      {/* Search Bar Skeleton */}
      <div className="w-full max-w-7xl mx-auto">
        <div className="h-14 bg-white shadow-sm border border-gray-100 rounded-lg animate-pulse w-full"></div>
      </div>

      {/* Grid Content Skeleton */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-lg shadow-soft border border-gray-100 flex flex-col gap-4"
          >
            <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse self-center"></div>
            <div className="h-5 bg-gray-200 rounded-md animate-pulse w-3/4 self-center mt-2"></div>
            <div className="h-3 bg-gray-200 rounded-md animate-pulse w-1/2 self-center"></div>
            
            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between">
              <div className="h-8 bg-gray-200 rounded-md animate-pulse w-1/3"></div>
              <div className="h-8 bg-gray-200 rounded-md animate-pulse w-1/3"></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
