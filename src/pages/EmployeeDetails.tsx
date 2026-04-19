import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Shield, ShieldAlert, Key, Zap, Loader2, User } from "lucide-react";
import toast from "react-hot-toast";
import CryptoJS from "crypto-js";
import { useAuth } from "../lib/auth";
import { formatCurrency } from "../lib/validations";
import { useSettingsStore } from "../store/settingsStore";

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_SECRET || "default_dev_secret_key_123";

export const EmployeeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role: currentAdminRole } = useAuth();
  const { settings } = useSettingsStore();
  
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Controls
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState("");
  
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ role: "", status: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        if (!id) return;
        const docRef = doc(db, "employees", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEmployee(data);
          setForm({ role: data.role, status: data.status });

          // Fetch metrics if authUid exists
          if (data.authUid) {
            const ordersRef = collection(db, "orders");
            const q = query(ordersRef, where("cashierId", "==", data.authUid));
            const oSnap = await getDocs(q);
            let totalRev = 0;
            oSnap.forEach(oDoc => {
              totalRev += (oDoc.data().total || 0);
            });
            setEmployee((prev: any) => ({
              ...prev,
              ordersHandled: oSnap.size,
              revenueGenerated: totalRev
            }));
          }
        } else {
          toast.error("Employee not found");
          navigate("/employees");
        }
      } catch (err) {
        toast.error("Error fetching employee details");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, navigate]);

  const handleRevealPassword = () => {
    if (showPassword) {
      setShowPassword(false);
    } else {
      if (!employee?.encryptedPassword) {
        toast.error("No encrypted password stored for this user.");
        return;
      }
      try {
        const bytes = CryptoJS.AES.decrypt(employee.encryptedPassword, SECRET_KEY);
        const plainText = bytes.toString(CryptoJS.enc.Utf8);
        if (plainText) {
          setDecryptedPassword(plainText);
          setShowPassword(true);
          toast("Password revealed.", { icon: "👀" });
          
          // Auto hide after 10s for security
          setTimeout(() => setShowPassword(false), 10000);
        } else {
          throw new Error("Bad decryption");
        }
      } catch (e) {
        toast.error("Failed to decrypt password. Might be a legacy account or mismatched key.");
      }
    }
  };

  const handleSaveControl = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "employees", id), {
        role: form.role,
        status: form.status
      });
      setEmployee({ ...employee, ...form });
      setEditMode(false);
      toast.success("Employee updated successfully");
    } catch (err) {
      toast.error("Failed to update employee details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-soft h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Loading Employee Profile</h2>
        </div>
     );
  }

  if (!employee) return null;

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Navigation */}
      <button onClick={() => navigate("/employees")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to Directory
      </button>

      {/* Header Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-6 rounded-2xl shadow-soft border border-gray-100 flex items-center justify-between">
         <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shadow-sm">
                {employee.avatarInitials || "U"}
            </div>
            <div>
               <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
               <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
                 <Mail className="w-4 h-4" /> {employee.email}
               </div>
               <div className="flex items-center gap-3 mt-2">
                 <span className="bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded-md text-xs">{employee.role}</span>
                 <span className={`font-semibold px-2.5 py-1 rounded-md text-xs ${employee.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                   {employee.status}
                 </span>
               </div>
            </div>
         </div>
      </motion.div>

      {/* Admin Controls */}
      {currentAdminRole === "Admin" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
           <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4" /> Advanced Admin Controls
              </h2>
           </div>
           
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <h3 className="font-semibold px-1 text-gray-900">Access Configuration</h3>
                 {!editMode ? (
                   <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-gray-500">Current Role:</span>
                         <span className="font-semibold">{employee.role}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-gray-500">Account Status:</span>
                         <span className="font-semibold text-green-600">{employee.status}</span>
                      </div>
                      <button onClick={() => setEditMode(true)} className="w-full mt-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors">
                        Edit Access
                      </button>
                   </div>
                 ) : (
                   <div className="space-y-4 bg-white p-4 rounded-xl border border-indigo-200 ring-1 ring-indigo-50 shadow-lg">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Organizational Role</label>
                        <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-gray-50 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                          <option value="Admin">Admin</option>
                          <option value="Sales">Sales</option>
                          <option value="Support">Support</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account Status</label>
                        <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-gray-50 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                          <option value="Active">Active</option>
                          <option value="On Leave">On Leave</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                        <button onClick={handleSaveControl} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-[80px] shadow-sm">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                        </button>
                      </div>
                   </div>
                 )}
              </div>

              <div className="space-y-4">
                 <h3 className="font-semibold px-1 text-gray-900">Security Diagnostics</h3>
                 <div className="bg-red-50/50 p-5 rounded-xl border border-red-100 flex flex-col items-start gap-3 h-full">
                    <p className="text-xs text-red-600 leading-relaxed font-medium">
                       <strong>NOTICE:</strong> Password retrieval is strictly for administrative onboarding/recovery. This feature relies on AES symmetric encryption and is not standard zero-knowledge secure practice.
                    </p>
                    
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-3.5 w-full justify-between shadow-sm mt-2">
                       <div className="flex items-center gap-3">
                         <Key className="w-5 h-5 text-gray-400" />
                         <span className="font-mono text-sm tracking-widest bg-gray-50 px-3 py-1 rounded text-gray-900 font-bold border border-gray-100">
                           {showPassword ? decryptedPassword : "••••••••"}
                         </span>
                       </div>
                       <button onClick={handleRevealPassword} className="text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-all shadow-sm">
                           {showPassword ? "Hide" : "Reveal"}
                       </button>
                    </div>

                    <button className="text-xs flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold mt-auto transition-colors" onClick={() => toast("A password reset link would be sent.", { icon: "📧" })}>
                       <Zap className="w-3.5 h-3.5" /> Force Password Reset via Email
                    </button>
                 </div>
              </div>
           </div>
        </motion.div>
      )}

      {/* Analytics Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card p-6 rounded-2xl shadow-soft border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
             <Shield className="w-5 h-5 text-green-500" /> Staff Performance Metrics
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl flex justify-between items-center hover:bg-blue-50/30 transition-colors">
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Orders Handled</p>
                  <p className="text-3xl font-black text-gray-900">{employee.ordersHandled || 0}</p>
               </div>
               <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <User className="w-7 h-7" />
               </div>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl flex justify-between items-center hover:bg-green-50/30 transition-colors">
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Revenue Generated</p>
                  <p className="text-3xl font-black text-gray-900">{formatCurrency(employee.revenueGenerated || 0, settings.currency || '₹')}</p>
               </div>
               <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <span className="text-2xl font-black">$</span>
               </div>
            </div>
          </div>
      </motion.div>
    </div>
  );
};
