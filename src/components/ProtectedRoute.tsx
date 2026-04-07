import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { PageLoader } from "./PageLoader";
import { hasPermission, type Permission } from "../lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  requiredPermission?: Permission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly, requiredPermission }) => {
  const { user, role, permissions, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Evaluate role-based routing
  if (adminOnly && role !== "Admin") {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
