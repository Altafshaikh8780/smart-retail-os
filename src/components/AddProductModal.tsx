import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { uploadMultipleImages } from "../lib/cloudinary";
import { useSettingsStore } from "../store/settingsStore";

const CATEGORIES = ["Phones", "Laptops", "Tablets", "Accessories", "Small Electronics", "Second-hand"];

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "", brand: "", price: "", category: "Phones", description: "", stock: "1", minStock: "0", costPrice: "", sku: "", supplierName: "", condition: "Good" as "Like New" | "Good" | "Fair" | "Poor", imei: ""
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { settings } = useSettingsStore();
  const currency = settings.currency || "$";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      
      const newUrls = files.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    let toastId;
    
    try {
      let uploadedUrls: string[] = [];
      
      if (selectedFiles.length > 0) {
        toastId = toast.loading("Uploading images...");
        uploadedUrls = await uploadMultipleImages(selectedFiles);
        toast.dismiss(toastId);
      }

      toastId = toast.loading("Saving product...");

      const sellingPrice = Number(formData.price);
      const costPrice = Number(formData.costPrice);
      const initialStock = Number(formData.stock);
      const minimumStock = Number(formData.minStock);

      if (sellingPrice <= 0) throw new Error("Selling price must be greater than 0");
      if (costPrice < 0) throw new Error("Cost price cannot be negative");
      if (initialStock < 0) throw new Error("Initial stock cannot be negative");
      if (minimumStock < 0) throw new Error("Min stock cannot be negative");
      if (costPrice > sellingPrice) throw new Error("Cost price cannot be higher than selling price");

      const generatedSku = formData.sku || `${formData.brand?.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-5)}`;

      const productData = {
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        price: sellingPrice,
        description: formData.description,
        images: uploadedUrls,
        stock: initialStock,
        minStock: minimumStock,
        sku: generatedSku,
        costPrice: costPrice,
        supplierName: formData.supplierName || "N/A",
        condition: formData.category === "Second-hand" ? formData.condition : "New",
        imei: formData.category === "Second-hand" ? formData.imei : "",
        createdAt: serverTimestamp()
      };

      const productRef = await addDoc(collection(db, "products"), productData);
      
      const inventoryData = {
        productId: productRef.id,
        name: formData.name,
        stock: initialStock,
        minStock: minimumStock,
        purchasePrice: costPrice,
        sellingPrice: sellingPrice,
        lastUpdated: serverTimestamp()
      };
      
      await addDoc(collection(db, "inventory"), inventoryData);
      
      toast.dismiss(toastId);
      toast.success("Product successfully added to catalog and inventory!");
      
      setFormData({ name: "", brand: "", price: "", category: "Phones", description: "", stock: "1", minStock: "0", costPrice: "", sku: "", supplierName: "", condition: "Good", imei: "" });
      setSelectedFiles([]);
      setPreviewUrls([]);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      if (toastId) toast.dismiss(toastId);
      toast.error(error.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
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
            className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
              <button 
                onClick={onClose} 
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-200 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <div className="overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200">
              <form id="addProductForm" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Image Upload Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-900">Product Images</label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button" 
                            onClick={() => removeImage(idx)}
                            className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Upload Button */}
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-primary gap-2 bg-gray-50">
                      <UploadCloud className="w-6 h-6" />
                      <span className="text-xs font-medium">Upload Image</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={handleFileChange}
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-gray-100 pt-6">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Product Name</label>
                    <input 
                      required 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                      placeholder="e.g. iPhone 15 Pro Max" 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Brand</label>
                    <input 
                      required 
                      value={formData.brand} 
                      onChange={e => setFormData({...formData, brand: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                      placeholder="e.g. Apple" 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">SKU (Optional)</label>
                    <input 
                      value={formData.sku} 
                      onChange={e => setFormData({...formData, sku: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                      placeholder="Auto-generated if empty" 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Category</label>
                    <select 
                      required 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50"
                      disabled={isSubmitting}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {formData.category === "Second-hand" && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-5 col-span-1 sm:col-span-2 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50"
                    >
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1.5">Condition</label>
                        <select 
                          value={formData.condition} 
                          onChange={e => setFormData({...formData, condition: e.target.value as any})} 
                          className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                        >
                          <option value="Like New">Like New (Mint)</option>
                          <option value="Good">Good (Minor wear)</option>
                          <option value="Fair">Fair (Noticeable wear)</option>
                          <option value="Poor">Poor (Functional only)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1.5">IMEI / Serial Number</label>
                        <input 
                          required={formData.category === "Second-hand"}
                          value={formData.imei} 
                          onChange={e => setFormData({...formData, imei: e.target.value})} 
                          className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white" 
                          placeholder="Unique ID required" 
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Cost Price ({currency})</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">{currency}</span>
                      </div>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={formData.costPrice} 
                        onChange={e => setFormData({...formData, costPrice: e.target.value})} 
                        className="w-full border border-gray-200 rounded-lg py-2.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                        placeholder="0.00" 
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Supplier Name (Optional)</label>
                    <input 
                      value={formData.supplierName} 
                      onChange={e => setFormData({...formData, supplierName: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                      placeholder="e.g. Smart Retail Logistics" 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Selling Price ({currency})</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">{currency}</span>
                      </div>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        required 
                        value={formData.price} 
                        onChange={e => setFormData({...formData, price: e.target.value})} 
                        className="w-full border border-gray-200 rounded-lg py-2.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                        placeholder="0.00" 
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Initial Stock</label>
                    <input 
                      type="number" 
                      min="0" 
                      required 
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                      placeholder="15" 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Min Stock Alert</label>
                    <input 
                      type="number" 
                      min="0" 
                      required 
                      value={formData.minStock} 
                      onChange={e => setFormData({...formData, minStock: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50" 
                      placeholder="5" 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Description</label>
                    <textarea 
                      required 
                      rows={4}
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className="w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 resize-none" 
                      placeholder="Provide detailed technical specifications and marketing description..." 
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </form>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="addProductForm"
                disabled={isSubmitting} 
                className="px-6 py-2 rounded-lg flex justify-center items-center text-sm font-medium text-white bg-primary hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-soft min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Add Product"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
