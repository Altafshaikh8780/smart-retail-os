import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Loader2, Mail, Lock, Shield, User } from "lucide-react";
import toast from "react-hot-toast";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { validatePhone } from "../lib/validations";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import CryptoJS from "crypto-js";

// IMPORTANT: This frontend AES encryption approach is NOT production secure.
// It is used here purely for administrative visibility/demo purposes.
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_SECRET || "default_dev_secret_key_123";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "Sales",
    phone: "",
    permissions: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      toast.error("Invalid phone number. Must be exactly 10 digits.");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Creating employee account...");

    try {
      // 1. Initialize a Secondary App to create the user without signing out the current Admin
      const secondaryApp = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      }, "SecondaryAuthApp" + Date.now()); // Unique name to prevent conflicts
      
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create the User via Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email, 
        formData.password
      );
      
      const uid = userCredential.user.uid;

      // 3. Compute Initials
      const nameParts = formData.name.split(" ");
      const avatarInitials = nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : formData.name.substring(0, 2).toUpperCase();

      // Encrypt the password for Admin viewing
      const encryptedPassword = CryptoJS.AES.encrypt(formData.password, SECRET_KEY).toString();

      // 4. Save to Firestore "employees" collection
      await setDoc(doc(db, "employees", uid), {
        uid,
        authUid: uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        permissions: formData.permissions,
        status: "Active",
        salesPerformance: 0,
        targetHit: false,
        avatarInitials,
        encryptedPassword,
        createdAt: serverTimestamp()
      });

      // Cleanup Secondary Auth Context
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      toast.success("Employee onboarding complete!", { id: toastId });
      
      // Reset & Close
      setFormData({ name: "", email: "", password: "", role: "Sales", phone: "", permissions: [] });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Employee Creation Error:", error);
      toast.error(error.message || "Failed to create employee.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={!isSubmitting ? onClose : undefined}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 flex flex-col my-8"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Register Employee
              </h2>
              <button 
                onClick={onClose} 
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" 
                      placeholder="e.g. Jane Doe"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Corporate Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" 
                      placeholder="name@smartretail.os"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Phone Number (Optional)</label>
                  <div className="relative">
                    <input 
                      type="tel"
                      maxLength={10}
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono" 
                      placeholder="10-digit mobile number"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Organizational Role</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm appearance-none bg-white font-medium text-gray-700"
                      disabled={isSubmitting}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Sales">Sales</option>
                      <option value="Support">Support</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5 flex items-center justify-between">
                    Temporary Password
                    <span className="text-xs font-normal text-gray-500">Min 6 chars</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="password"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg py-2.5 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" 
                      placeholder="••••••••"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="px-5 py-2 rounded-lg flex items-center justify-center text-sm font-medium text-white bg-primary hover:bg-blue-600 disabled:opacity-70 transition-colors shadow-soft min-w-[130px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Employee"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
