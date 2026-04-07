import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2, Smartphone, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { uploadMultipleImages } from "../lib/cloudinary";
import { useSettingsStore } from "../store/settingsStore";
import { useAuth } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";

const BRANDS = ["Apple", "Samsung", "OnePlus", "Xiaomi", "Oppo", "Vivo", "Realme", "Nokia", "Motorola", "Google", "Huawei", "Other"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Damaged"] as const;
const DEVICE_STATUS = ["Fully Original", "Repaired", "Parts Replaced"] as const;

type Condition = typeof CONDITIONS[number];
type DeviceStatus = typeof DEVICE_STATUS[number];

interface FormData {
  deviceName: string;
  brand: string;
  model: string;
  imei: string;
  condition: Condition;
  deviceStatus: DeviceStatus;
  partsReplaced: string;
  batteryHealth: string;
  boughtFrom: string;
  purchasePrice: string;
  sellingPrice: string;
  notes: string;
}

interface AddSecondHandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddSecondHandModal: React.FC<AddSecondHandModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { settings } = useSettingsStore();
  const currency = settings.currency || "₹";
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    deviceName: "",
    brand: "Apple",
    model: "",
    imei: "",
    condition: "Good",
    deviceStatus: "Fully Original",
    partsReplaced: "",
    batteryHealth: "",
    boughtFrom: "",
    purchasePrice: "",
    sellingPrice: "",
    notes: "",
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApple = formData.brand === "Apple";
  const showPartsReplaced = formData.deviceStatus === "Parts Replaced";

  const update = (field: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    }
  };

  const removeImage = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (!formData.deviceName.trim()) return "Device name is required";
    if (!formData.model.trim()) return "Model is required";
    if (!formData.imei.trim()) return "IMEI / Unique ID is required";
    if (!formData.boughtFrom.trim()) return "Bought From is required";
    const purchasePrice = Number(formData.purchasePrice);
    const sellingPrice = Number(formData.sellingPrice);
    if (!formData.purchasePrice || purchasePrice <= 0) return "Purchase price must be greater than 0";
    if (!formData.sellingPrice || sellingPrice <= 0) return "Selling price must be greater than 0";
    if (purchasePrice > sellingPrice) return "Purchase price cannot exceed selling price";
    if (isApple) {
      const bh = Number(formData.batteryHealth);
      if (!formData.batteryHealth || bh < 1 || bh > 100) return "Battery health must be between 1 and 100%";
    }
    if (showPartsReplaced && !formData.partsReplaced.trim()) return "Please specify what parts were replaced";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) { toast.error(error); return; }

    setIsSubmitting(true);
    let toastId = toast.loading("Validating IMEI...");

    try {
      // Check IMEI uniqueness
      const imeiCheck = await getDocs(
        query(collection(db, "products"), where("imei", "==", formData.imei.trim()))
      );
      if (!imeiCheck.empty) {
        toast.error("A device with this IMEI already exists in the system.", { id: toastId });
        return;
      }

      toast.loading("Uploading images...", { id: toastId });
      let uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        uploadedUrls = await uploadMultipleImages(selectedFiles);
      }

      toast.loading("Saving device...", { id: toastId });

      const productData = {
        name: formData.deviceName,
        brand: formData.brand,
        model: formData.model,
        category: "Second-hand",
        price: Number(formData.sellingPrice),
        costPrice: Number(formData.purchasePrice),
        stock: 1,
        minStock: 1,
        imei: formData.imei.trim(),
        condition: formData.condition,
        deviceStatus: formData.deviceStatus,
        partsReplaced: showPartsReplaced ? formData.partsReplaced : "",
        batteryHealth: isApple ? Number(formData.batteryHealth) : null,
        boughtFrom: formData.boughtFrom,
        notes: formData.notes,
        images: uploadedUrls,
        isSecondHand: true,
        sku: `SH-${formData.brand.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-5)}`,
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "products"), productData);

      await logActivity({
        action: "product.added",
        actorId: user?.uid || "unknown",
        actorName: user?.email || "Staff",
        targetId: ref.id,
        targetName: formData.deviceName,
        meta: { category: "Second-hand", imei: formData.imei },
      });

      toast.success("Second-hand device added successfully!", { id: toastId });

      setFormData({ deviceName: "", brand: "Apple", model: "", imei: "", condition: "Good", deviceStatus: "Fully Original", partsReplaced: "", batteryHealth: "", boughtFrom: "", purchasePrice: "", sellingPrice: "", notes: "" });
      setSelectedFiles([]);
      setPreviewUrls([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add device", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50";
  const labelClass = "block text-sm font-semibold text-gray-800 mb-1.5";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={!isSubmitting ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-xl relative z-10 border border-gray-100 flex flex-col max-h-[92vh] my-4"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-xl">
                  <Smartphone className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add Second-Hand Device</h2>
                  <p className="text-xs text-gray-500">Fill in all details for accurate inventory tracking</p>
                </div>
              </div>
              <button onClick={onClose} disabled={isSubmitting} className="p-1.5 rounded-full hover:bg-white/80 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto p-6 space-y-6">
              <form id="shForm" onSubmit={handleSubmit} className="space-y-6">

                {/* Images */}
                <div>
                  <label className={labelClass}>Device Photos</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <button type="button" onClick={() => removeImage(idx)} className="bg-red-500 text-white p-1 rounded-full">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 transition-colors cursor-pointer flex flex-col items-center justify-center text-gray-400 hover:text-violet-500 gap-1">
                      <UploadCloud className="w-5 h-5" />
                      <span className="text-[10px] font-semibold">Upload</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                    </label>
                  </div>
                </div>

                {/* Section: Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Device Name <span className="text-red-500">*</span></label>
                      <input required value={formData.deviceName} onChange={e => update("deviceName", e.target.value)} className={inputClass} placeholder="e.g. iPhone 13 Pro 256GB" disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className={labelClass}>Brand <span className="text-red-500">*</span></label>
                      <select value={formData.brand} onChange={e => update("brand", e.target.value)} className={inputClass} disabled={isSubmitting}>
                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Model <span className="text-red-500">*</span></label>
                      <input required value={formData.model} onChange={e => update("model", e.target.value)} className={inputClass} placeholder="e.g. A2635" disabled={isSubmitting} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>IMEI / Unique Serial <span className="text-red-500">*</span></label>
                      <input required value={formData.imei} onChange={e => update("imei", e.target.value)} className={inputClass} placeholder="15-digit IMEI or unique identifier" disabled={isSubmitting} />
                    </div>
                  </div>
                </div>

                {/* Section: Condition */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Condition & Status</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Physical Condition <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {CONDITIONS.map(c => (
                          <button key={c} type="button" onClick={() => update("condition", c)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${formData.condition === c ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Device Status <span className="text-red-500">*</span></label>
                      <div className="space-y-2">
                        {DEVICE_STATUS.map(s => (
                          <button key={s} type="button" onClick={() => update("deviceStatus", s)}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold border-2 text-left transition-all ${formData.deviceStatus === s ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Conditional: Parts Replaced */}
                  <AnimatePresence>
                    {showPartsReplaced && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <label className={labelClass}>Parts Replaced <span className="text-red-500">*</span></label>
                        <input value={formData.partsReplaced} onChange={e => update("partsReplaced", e.target.value)} className={inputClass} placeholder="e.g. Screen, battery, charging port" disabled={isSubmitting} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Conditional: Apple Battery Health */}
                  <AnimatePresence>
                    {isApple && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <label className={`${labelClass} text-blue-800`}>🔋 Battery Health (%) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <input type="number" min={1} max={100} value={formData.batteryHealth} onChange={e => update("batteryHealth", e.target.value)}
                            className="w-full border border-blue-200 bg-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                            placeholder="e.g. 87" disabled={isSubmitting} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-500 font-bold">%</span>
                        </div>
                        {formData.batteryHealth && (Number(formData.batteryHealth) < 80) && (
                          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Below 80% — consider disclosing to buyer</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Section: Purchase Info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Acquisition & Pricing</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Bought From (Customer / Vendor) <span className="text-red-500">*</span></label>
                      <input required value={formData.boughtFrom} onChange={e => update("boughtFrom", e.target.value)} className={inputClass} placeholder="e.g. Rahul Sharma / TechVision Distributors" disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className={labelClass}>Purchase Price ({currency}) <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
                        <input type="number" step="0.01" min="0" required value={formData.purchasePrice} onChange={e => update("purchasePrice", e.target.value)}
                          className={`${inputClass} pl-7`} placeholder="0.00" disabled={isSubmitting} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Selling Price ({currency}) <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
                        <input type="number" step="0.01" min="0" required value={formData.sellingPrice} onChange={e => update("sellingPrice", e.target.value)}
                          className={`${inputClass} pl-7`} placeholder="0.00" disabled={isSubmitting} />
                      </div>
                      {formData.purchasePrice && formData.sellingPrice && Number(formData.purchasePrice) > Number(formData.sellingPrice) && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Selling price is below purchase price</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Additional Notes (Optional)</label>
                      <textarea rows={3} value={formData.notes} onChange={e => update("notes", e.target.value)}
                        className={`${inputClass} resize-none`} placeholder="Any additional remarks, accessories included, etc." disabled={isSubmitting} />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" form="shForm" disabled={isSubmitting} className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors flex items-center gap-2 min-w-[140px] justify-center shadow-sm">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Add Device"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
