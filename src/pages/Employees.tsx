import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Mail, Shield, User, TrendingUp, MoreVertical, Loader2, Users } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { AddEmployeeModal } from "../components/AddEmployeeModal";
import { useNavigate } from "react-router-dom";

type EmployeeRole = "Admin" | "Sales" | "Support";
type EmployeeStatus = "Active" | "On Leave" | "Inactive";

type EmployeeRecord = {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  salesPerformance: number;
  avatarInitials: string;
  targetHit: boolean;
  phone?: string;
  permissions?: string[];
  authUid?: string;
};

// Mock employees removed in favor of live Firestore database querying

export const Employees: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const q = query(collection(db, "employees"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data: EmployeeRecord[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as EmployeeRecord);
      });
      setEmployees(data);
    } catch (err: any) {
      console.error("Error fetching employees:", err);
      setError(err.message || "Failed to load employee data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">Manage staff, roles, and track sales performance.</p>
        </motion.div>
        
        {role === "Admin" && (
          <motion.button 
            onClick={() => setIsModalOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-primary text-white px-4 py-2 rounded-lg font-medium shadow-soft hover:shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-5 h-5" />
            Add Employee
          </motion.button>
        )}
      </div>

      {/* 2 & 3. Employee Cards Grid with Animations */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-soft h-[50vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Loading Team Data</h2>
          <p className="text-gray-500 max-w-sm text-center mt-2">Connecting to secure HR database to retrieve employee records.</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-red-100 shadow-soft h-[50vh]">
          <div className="w-16 h-16 bg-red-50 text-red-500 flex items-center justify-center rounded-full mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Connection Error</h2>
          <p className="text-red-500 max-w-sm text-center mt-2">{error}</p>
          <button 
            onClick={fetchEmployees}
            className="mt-6 bg-red-50 text-red-600 px-6 py-2.5 rounded-lg font-medium hover:bg-red-100 transition-all"
          >
            Try Again
          </button>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm h-[50vh]">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 flex items-center justify-center rounded-full mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Employees Found</h2>
          <p className="text-gray-500 max-w-sm text-center mt-2">No employee records are available at the moment.</p>
          {role === "Admin" && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-6 bg-primary text-white px-6 py-2.5 rounded-lg font-medium shadow-soft hover:shadow-md transition-all flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Register First Employee
            </button>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
          <AnimatePresence mode="popLayout">
            {employees.map((employee) => (
              <motion.div
                layout
                key={employee.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.3 }}
                whileHover={{ y: -6, scale: 1.02 }}
                onClick={() => navigate(`/employees/${employee.id}`)}
                className="bg-card rounded-lg shadow-soft border border-gray-100 overflow-hidden cursor-pointer group flex flex-col relative"
              >
                {/* More Actions */}
                <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100 z-10">
                  <MoreVertical className="w-5 h-5" />
                </button>

                <div className="p-6 pb-4 flex flex-col items-center">
                  {/* Avatar with Status Badge Glow */}
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shadow-sm mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      {employee.avatarInitials || "SC"}
                    </div>
                    {employee.status === "Active" ? (
                      <div className="absolute bottom-4 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" title="Active"></div>
                    ) : employee.status === "On Leave" ? (
                      <div className="absolute bottom-4 right-0 w-4 h-4 bg-orange-400 border-2 border-white rounded-full shadow-[0_0_8px_rgba(251,146,60,0.6)]" title="On Leave"></div>
                    ) : (
                      <div className="absolute bottom-4 right-0 w-4 h-4 bg-gray-400 border-2 border-white rounded-full" title="Inactive"></div>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-lg text-center truncate w-full">{employee.name}</h3>
                  
                  <div className="flex items-center gap-1.5 text-gray-500 mt-1.5 text-sm truncate max-w-full">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                </div>
                
                {/* Role & Performance */}
                <div className="mt-auto px-6 pb-6 pt-2 space-y-4">
                  <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                    <div className="flex items-center gap-1.5 text-gray-600 font-medium text-sm bg-gray-50 px-2.5 py-1 rounded-md">
                      {employee.role === "Admin" ? <Shield className="w-4 h-4 text-blue-500" /> : <User className="w-4 h-4 text-gray-500" />}
                      {employee.role || "Employee"}
                    </div>
                    
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border whitespace-nowrap
                      ${employee.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 
                        employee.status === 'On Leave' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                        'bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                      {employee.status || "Inactive"}
                    </span>
                  </div>

                  {/* Sales Performance Bar */}
                  {employee.role?.includes("Sales") && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" /> Performance (YTD)
                        </span>
                        <span className={`font-bold ${employee.targetHit ? "text-green-600" : "text-gray-700"}`}>
                          {employee.salesPerformance || 0}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-1
                            ${(employee.salesPerformance || 0) >= 100 ? 'bg-primary' : (employee.salesPerformance || 0) >= 70 ? 'bg-blue-400' : 'bg-gray-400'}`}
                          style={{ width: `${Math.min(employee.salesPerformance || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddEmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchEmployees}
      />
    </div>
  );
};
