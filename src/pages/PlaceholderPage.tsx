import React from "react";

export const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center space-y-4">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center shadow-inner">
        <span className="text-4xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500">This page is under construction or coming in the next phase.</p>
    </div>
  );
};
