import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, User, Store, Shield, Loader2, Brain } from "lucide-react";
import toast from "react-hot-toast";
import { updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useSettingsStore } from "../store/settingsStore";

export const Settings: React.FC = () => {
  const { user, role } = useAuth();
  const { settings, fetchSettings, updateSettings, loading: storeLoading } = useSettingsStore();

  const [saving, setSaving] = useState(false);
  const [storeConfig, setStoreConfig] = useState({
    storeName: "",
    currency: "₹",
    storeAddress: "",
    gstNumber: "",
    taxRate: 18,
    leadTimeDays: 5,
    safetyStock: 5,
  });

  const [securityData, setSecurityData] = useState({ newPassword: "", confirmPassword: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!storeLoading) {
      setStoreConfig({
        storeName: settings.storeName || "Smart Retail OS",
        currency: settings.currency || "₹",
        storeAddress: settings.storeAddress || "",
        gstNumber: settings.gstNumber || "",
        taxRate: settings.taxRate ?? 18,
        leadTimeDays: settings.leadTimeDays ?? 5,
        safetyStock: settings.safetyStock ?? 5,
      });
    }
  }, [settings, storeLoading]);

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storeConfig.leadTimeDays < 1) { toast.error("Lead time must be at least 1 day"); return; }
    if (storeConfig.safetyStock < 0) { toast.error("Safety stock cannot be negative"); return; }
    setSaving(true);
    try {
      await updateSettings(storeConfig);
      toast.success("Store settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityData.newPassword !== securityData.confirmPassword) { toast.error("Passwords do not match"); return; }
    if (securityData.newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      if (!auth.currentUser) throw new Error("No user logged in");
      await updatePassword(auth.currentUser, securityData.newPassword);
      toast.success("Password updated successfully");
      setSecurityData({ newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        toast.error("Please log out and log back in to change your password.");
      } else {
        toast.error(err.message || "Failed to update password");
      }
    } finally {
      setSaving(false);
    }
  };

  if (storeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-soft h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Loading Configuration</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage store configuration, AI parameters, and security preferences.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* Profile (read-only) */}
        <div className="bg-card p-6 rounded-2xl shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-gray-900">Admin Profile</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input type="email" value={user?.email || ""} disabled className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
              <input type="text" value={role || "Admin"} disabled className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-500 cursor-not-allowed" />
            </div>
          </div>
        </div>

        {/* Store Configuration */}
        <form onSubmit={handleSaveStoreSettings} className="bg-card p-6 rounded-2xl shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Store className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-gray-900">Store Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Store Name</label>
              <input type="text" value={storeConfig.storeName} onChange={e => setStoreConfig({...storeConfig, storeName: e.target.value})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Currency (ISO Code)</label>
              <select value={storeConfig.currency} onChange={e => setStoreConfig({...storeConfig, currency: e.target.value})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all">
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tax / GST Rate (%)</label>
              <input type="number" min={0} max={100} value={storeConfig.taxRate} onChange={e => setStoreConfig({...storeConfig, taxRate: Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">GST / Tax ID</label>
              <input type="text" value={storeConfig.gstNumber} onChange={e => setStoreConfig({...storeConfig, gstNumber: e.target.value})}
                placeholder="e.g. 29ABCDE1234F2Z5"
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Store Address</label>
              <textarea rows={2} value={storeConfig.storeAddress} onChange={e => setStoreConfig({...storeConfig, storeAddress: e.target.value})}
                placeholder="Full store address"
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="bg-primary text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium hover:bg-blue-600 transition-colors shadow-soft">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </form>

        {/* AI Restock Parameters */}
        <form onSubmit={handleSaveStoreSettings} className="bg-card p-6 rounded-2xl shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><Brain className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Restock Parameters</h2>
              <p className="text-xs text-gray-400 mt-0.5">These values are used by the AI engine to calculate optimal restock quantities.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lead Time (days)</label>
              <input type="number" min={1} max={90} value={storeConfig.leadTimeDays}
                onChange={e => setStoreConfig({...storeConfig, leadTimeDays: Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all" />
              <p className="text-xs text-gray-400 mt-1">Number of days from order to delivery (default: 5)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Safety Stock (units)</label>
              <input type="number" min={0} max={500} value={storeConfig.safetyStock}
                onChange={e => setStoreConfig({...storeConfig, safetyStock: Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all" />
              <p className="text-xs text-gray-400 mt-1">Buffer stock to maintain at all times (default: 5)</p>
            </div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-xs text-violet-700 mb-6">
            <strong>Formula:</strong> Recommended Stock = (Daily Sales × Lead Time) + Safety Stock &nbsp;|&nbsp;
            <strong>Restock Qty</strong> = Recommended − Current Stock
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="bg-violet-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium hover:bg-violet-700 transition-colors shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save AI Settings
            </button>
          </div>
        </form>

        {/* Security */}
        <form onSubmit={handleChangePassword} className="bg-card p-6 rounded-2xl shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Shield className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-gray-900">Security</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
              <input type="password" placeholder="••••••••" value={securityData.newPassword}
                onChange={e => setSecurityData({...securityData, newPassword: e.target.value})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
              <input type="password" placeholder="••••••••" value={securityData.confirmPassword}
                onChange={e => setSecurityData({...securityData, confirmPassword: e.target.value})}
                className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !securityData.newPassword}
              className="bg-white border border-gray-200 text-gray-800 px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Update Password
            </button>
          </div>
        </form>

      </motion.div>
    </div>
  );
};
