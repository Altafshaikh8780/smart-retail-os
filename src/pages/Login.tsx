import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/auth";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Store, LogIn, Eye, EyeOff } from "lucide-react";

import { useSettingsStore } from "../store/settingsStore";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [errors, setErrors] = useState<{email?: string, password?: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const { settings, fetchSettings } = useSettingsStore();

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // UI Validation
    const newErrors: {email?: string, password?: string} = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setLoading(true);

    try {
      const userCredential = await login(email, password);
      
      // Auto-assign Admin role for specific email
      if (email.toLowerCase() === 'admin@sros.com') {
         const { doc, setDoc } = await import("firebase/firestore");
         const { db } = await import("../lib/firebase");
         const docRef = doc(db, "employees", userCredential.user.uid);
         await setDoc(docRef, { role: "Admin", email: email, name: "Super Admin", status: "Active" }, { merge: true });
      }

      toast.success("Successfully logged in!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="flex justify-center flex-col items-center">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-white shadow-soft mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            {settings.storeName || "Smart Retail OS"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Sign in to access your admin dashboard
          </p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-card py-8 px-4 shadow-soft sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({...errors, email: undefined});
                  }}
                  className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm transition-all ${
                    errors.email ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-gray-300 focus:ring-primary/20 focus:border-primary"
                  }`}
                  placeholder="Email Address"
                />
                {errors.email && <p className="text-sm text-red-500 mt-1.5">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({...errors, password: undefined});
                  }}
                  className={`appearance-none block w-full px-3 py-2 pr-10 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm transition-all ${
                    errors.password ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-gray-300 focus:ring-primary/20 focus:border-primary"
                  }`}
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-500 mt-1.5">{errors.password}</p>}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
              >
                {loading ? "Authenticating..." : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
