import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const baseClasses = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors duration-300";
  
  let variantClasses = "";
  switch (variant) {
    case "success":
      variantClasses = "bg-green-50 text-green-700 border-green-200 hover:bg-green-100";
      break;
    case "warning":
      variantClasses = "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
      break;
    case "danger":
      variantClasses = "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
      break;
    case "info":
      variantClasses = "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
      break;
    case "default":
    default:
      variantClasses = "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";
      break;
  }

  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`} {...props}>
      {children}
    </span>
  );
}
