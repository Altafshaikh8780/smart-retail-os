import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, limit, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Package, Edit, AlertCircle, FileText,
  ChevronRight, CheckCircle2, AlertTriangle,
  CreditCard, Brain, TrendingUp, Zap, X, ShoppingBag,
  Trash2, Star, UploadCloud
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../lib/auth";
import { useSettingsStore } from "../store/settingsStore";
import { useCartStore } from "../store/cartStore";
import { calculateRestockRecommendation, type AIRestockResult } from "../lib/aiRestock";
import { logActivity } from "../lib/activityLogger";
import { formatCurrency } from "../lib/validations";
import { uploadImage } from "../lib/cloudinary";

type ProductData = {
  name: string;
  brand: string;
  price: number;
  description: string;
  images: string[];
  category: string;
  stock: number;
  minStock?: number;
  costPrice?: number;
  condition?: string;
  imei?: string;
  sku?: string;
  supplierName?: string;
  lowStockThreshold?: number;
};

// No extra mock data needed
const mockLifecycle = { createdAt: "2024-01-12T10:30:00Z", updatedAt: "2024-04-03T14:45:00Z", updatedBy: "Admin User" };

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { settings } = useSettingsStore();
  const addItem = useCartStore((state) => state.addItem);
  const currency = settings.currency || "₹";
  const isAdmin = role === "Admin";

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
// Removed auditLogs state

  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ price: 0, stock: 0, description: "", supplierName: "", minStock: 0 });

  // AI Restock state
  const [aiResult, setAiResult] = useState<AIRestockResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  const [aiCalculated, setAiCalculated] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const docRef = doc(db, "products", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ProductData;
        setProduct(data);
        if (data.images?.length > 0 && !mainImage) setMainImage(data.images[0]);
        setEditFormData({
          price: data.price || 0,
          stock: data.stock || 0,
          description: data.description || "",
          supplierName: (data as any).supplierName || "",
          minStock: data.minStock || data.lowStockThreshold || 0,
        });

         // Audit logs fetch removed
      } else {
        if (!product) {
          toast.error("Product not found");
          navigate("/products");
        }
      }
    } catch (error: any) {
      // Only show error if we completely failed and have no cached/existing data to show
      if (!product) toast.error("Failed to load product details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !product) return;
    if (Number(editFormData.price) <= 0) { toast.error("Price must be greater than 0"); return; }
    if (Number(editFormData.stock) < 0) { toast.error("Stock cannot be negative"); return; }
    try {
      const pRef = doc(db, "products", id);
      await updateDoc(pRef, {
        price: Number(editFormData.price),
        stock: Number(editFormData.stock),
        minStock: Number(editFormData.minStock),
        description: editFormData.description,
        supplierName: editFormData.supplierName,
      });

      // Sync to Inventory
      const invQ = query(collection(db, "inventory"), where("productId", "==", id), limit(1));
      const invSnap = await getDocs(invQ);
      if (!invSnap.empty) {
        await updateDoc(doc(db, "inventory", invSnap.docs[0].id), {
          stock: Number(editFormData.stock),
          minStock: Number(editFormData.minStock),
          name: product.name,
          sellingPrice: Number(editFormData.price),
          lastUpdated: serverTimestamp()
        });
      }
      await logActivity({
        action: "product.edited",
        actorId: user?.uid || "Admin",
        actorName: user?.email || "Admin User",
        targetId: id,
        targetName: product.name,
        meta: { price: editFormData.price, stock: editFormData.stock },
      });
      toast.success("Product updated successfully!");
      setIsEditing(false);
      fetchProduct();
    } catch (err) {
      toast.error("Failed to update product");
    }
  };

  // AI Restock functions
  const runAIAnalysis = async () => {
    if (!id || !product) return;
    setAiLoading(true);
    try {
      const result = await calculateRestockRecommendation(
        id, product.stock, product.minStock || 10,
        { leadTimeDays: settings.leadTimeDays || 5, safetyStock: settings.safetyStock || 5, lookbackDays: 30 }
      );
      setAiResult(result);
      setAiCalculated(true);
    } catch (err) {
      toast.error("Failed to run AI analysis");
    } finally {
      setAiLoading(false);
    }
  };

    const applyAIRestock = async () => {
    if (!id || !product || !aiResult) return;
    if (aiResult.suggestedRestockQty <= 0) { toast("No restock needed — stock is sufficient!", { icon: "✅" }); return; }
    setAiApplying(true);
    try {
      const oldStock = product.stock;
      const newStock = oldStock + aiResult.suggestedRestockQty;
      await updateDoc(doc(db, "products", id), { stock: newStock });
      
      // Sync to Inventory
      const invQ = query(collection(db, "inventory"), where("productId", "==", id), limit(1));
      const invSnap = await getDocs(invQ);
      if (!invSnap.empty) {
        await updateDoc(doc(db, "inventory", invSnap.docs[0].id), { 
          stock: newStock,
          lastUpdated: serverTimestamp() 
        });
      }
      await logActivity({
        action: "inventory.restocked",
        actorId: user?.uid || "Admin",
        actorName: user?.email || "Admin User",
        targetId: id,
        targetName: product.name,
        meta: {
          message: `AI restocked ${aiResult.suggestedRestockQty} units (Stock: ${oldStock} → ${newStock})`,
          oldStock,
          newStock,
          qty: aiResult.suggestedRestockQty,
          triggeredBy: "AI_RESTOCK",
        },
      });
      toast.success(`Restocked ${aiResult.suggestedRestockQty} units! New stock: ${newStock}`);
      setAiCalculated(false);
      setAiResult(null);
      fetchProduct();
    } catch (err) {
      toast.error("Failed to apply restock");
    } finally {
      setAiApplying(false);
    }
  };

  const handleAddImage = async (file: File) => {
    if (!id || !product) return;
    if (product.images.length >= 8) { toast.error("Maximum 8 images allowed"); return; }
    
    setIsUploading(true);
    let toastId = toast.loading("Uploading image...");
    try {
      const url = await uploadImage(file);
      const updatedImages = [...product.images, url];
      await updateDoc(doc(db, "products", id), { images: updatedImages });
      toast.dismiss(toastId);
      toast.success("Image added successfully");
      fetchProduct();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (imgToDelete: string) => {
    if (!id || !product) return;
    if (product.images.length <= 1) { toast.error("At least one image is required"); return; }
    
    try {
      const updatedImages = product.images.filter(img => img !== imgToDelete);
      await updateDoc(doc(db, "products", id), { images: updatedImages });
      if (mainImage === imgToDelete) setMainImage(updatedImages[0]);
      toast.success("Image removed");
      fetchProduct();
    } catch (err) {
      toast.error("Failed to delete image");
    }
  };

  const setPrimaryImage = async (img: string) => {
    if (!id || !product) return;
    try {
      const updatedImages = [img, ...product.images.filter(i => i !== img)];
      await updateDoc(doc(db, "products", id), { images: updatedImages });
      setMainImage(img);
      toast.success("Primary image updated");
      fetchProduct();
    } catch (err) {
      toast.error("Failed to update primary image");
    }
  };

  if (loading) {
    return (
      <div className="h-full min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Product Not Found</h2>
        <button onClick={() => navigate("/products")} className="mt-6 px-6 py-2 bg-primary text-white rounded-lg font-medium">Back to Catalog</button>
      </div>
    );
  }

  const sku = product.sku || `SROS-${id?.slice(-6).toUpperCase()}`;
  const costPrice = product.costPrice || (product.price * 0.65);
  const profitMargin = ((product.price - costPrice) / product.price) * 100;
  const minStock = product.minStock || 10;
  const maxStock = Math.max(100, product.stock * 1.5);
  const stockPercentage = Math.min(100, (product.stock / maxStock) * 100);
  const isWarning = product.stock <= minStock && product.stock > 0;
  const isCritical = product.stock <= 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm font-medium text-slate-500">
            <Link to="/inventory" className="hover:text-primary transition-colors hover:underline">Inventory</Link>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <Link to="/products" className="hover:text-primary transition-colors hover:underline">{product.category}</Link>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <span className="text-slate-800">{sku}</span>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Universal Add to Cart Button */}
          <button
            onClick={() => {
              if ((product?.stock ?? 0) <= 0) {
                toast.error("Cannot add out of stock item");
                return;
              }
              addItem({
                productId: id!,
                name: product!.name,
                price: product!.price,
                quantity: 1,
                stock: product!.stock,
                image: mainImage || product!.images?.[0] || "",
                category: product!.category,
                costPrice: product!.costPrice || 0
              });
              toast.success("Added to cart");
            }}
            disabled={(product?.stock ?? 0) <= 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingBag className="w-4 h-4" />
            Add to Cart
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20 active:scale-95"
            >
              <Edit className="w-4 h-4" />
              Edit Product
            </button>
          )}
        </div>
      </div>

      {/* MAIN 3-COL GRID */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* LEFT: Product Images */}
        <div className="w-full lg:w-[40%] space-y-4">
          <Card className="overflow-hidden bg-slate-50 border-slate-200">
            <div className="aspect-square relative group">
              {mainImage ? (
                <motion.img 
                  key={mainImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={mainImage} 
                  alt={product.name} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                  <Package className="w-20 h-20 mb-2" />
                  <span className="text-sm font-medium">No Image Available</span>
                </div>
              )}
            </div>
          </Card>

          {/* Thumbnail Strip */}
          <div className="space-y-4">
            {product.images && product.images.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {product.images.map((img, idx) => (
                  <div key={idx} className="relative group/thumb flex-shrink-0">
                    <button
                      onClick={() => setMainImage(img)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                        mainImage === img ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-slate-300"
                      }`}
                    >
                      <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <div className="absolute top-1 left-1 bg-yellow-400 p-0.5 rounded-full shadow-sm">
                          <Star className="w-2.5 h-2.5 text-white fill-current" />
                        </div>
                      )}
                    </button>
                    
                    {isAdmin && (
                      <div className="absolute -top-2 -right-2 flex flex-col gap-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteImage(img); }}
                          className="bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 active:scale-90"
                          title="Delete image"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {idx !== 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPrimaryImage(img); }}
                            className="bg-primary text-white p-1 rounded-full shadow-md hover:bg-blue-600 active:scale-90"
                            title="Set as primary"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAdmin && (
              <div className="pt-2">
                <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group/upload">
                  <UploadCloud className="w-5 h-5 text-slate-400 group-hover/upload:text-primary transition-colors" />
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-slate-600 group-hover/upload:text-primary transition-colors">Add Image</span>
                    <span className="text-[10px] text-slate-400">Max 8 images allowed</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddImage(file);
                    }}
                  />
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin ml-auto text-primary" />}
                </label>
              </div>
            )}
          </div>
          
          <div className="bg-blue-50 border border-blue-100/50 rounded-xl p-4">
             <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Stock ID / Tracking</h4>
             <p className="text-sm font-mono font-bold text-blue-900">{product.sku || "N/A"}</p>
          </div>
        </div>

        {/* RIGHT: Financial + Inventory + AI Cards */}
        <div className="w-full lg:w-[60%] flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Financial Summary — role-gated */}
            <Card className="h-full">
              <CardContent>
                <CardTitle className="tracking-widest uppercase text-[10px] font-bold text-slate-500 mb-6 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Financial Summary
                </CardTitle>
                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-slate-500 font-medium">Selling Price</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {formatCurrency(product.price, currency)}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Cost Price</span>
                        <span className="text-base font-bold text-slate-700">{formatCurrency(product.costPrice || 0, currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Profit Margin</span>
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          +{profitMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {!isAdmin && (
                    <p className="text-[10px] text-slate-400 font-medium pt-3 border-t border-slate-100 uppercase tracking-wider">Access to cost metrics is restricted.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Inventory Status */}
            <Card className="h-full">
              <CardContent>
                <div className="flex justify-between items-center mb-6">
                  <CardTitle className="tracking-widest uppercase text-[10px] font-bold text-slate-500 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" /> Inventory Status
                  </CardTitle>
                  {isCritical && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />}
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-4xl font-black text-slate-900">{product.stock} <span className="text-sm font-medium text-slate-400">units</span></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Min: {minStock}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isCritical ? "bg-red-500" : isWarning ? "bg-orange-400" : "bg-blue-500"}`} style={{ width: `${stockPercentage}%` }} />
                  </div>
                  <div className="flex items-center gap-2">
                    {isCritical ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : isWarning ? <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    <p className={`text-[11px] font-bold uppercase tracking-tight ${isCritical ? "text-red-600" : isWarning ? "text-orange-600" : "text-slate-500"}`}>
                      {isCritical ? "Zero Stock! Order Immediately" : isWarning ? "Low Stock Warning" : "Healthy Stock Levels"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-16 h-16 text-blue-400" />
                </div>
                <h3 className="text-white font-bold text-lg relative z-10">Sales Analytics</h3>
                <p className="text-slate-400 text-xs mt-1 relative z-10">
                  {aiResult ? `Moving ~${aiResult.dailySales} units daily` : "Volume tracking active"}
                </p>
                <div className="mt-6 flex items-end gap-1.5 h-12">
                  {[30, 45, 25, 60, 40, 70, 55, 85].map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-500/40 rounded-t-sm hover:bg-blue-400 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Primary Supplier</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {(product as any).supplierName?.charAt(0) || "T"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{(product as any).supplierName || "TechVision Distributors"}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold uppercase mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Verified
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50 mt-4">
                   <div className="flex-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Created</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">{new Date(mockLifecycle.createdAt).toLocaleDateString()}</p>
                   </div>
                   <div className="flex-1 text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">By</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">{mockLifecycle.updatedBy}</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* ====== AI RESTOCK CARD ====== */}
      <div className="bg-gradient-to-br from-violet-900 to-indigo-900 rounded-2xl shadow-lg border border-violet-800 overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-violet-700/50 rounded-xl">
                <Brain className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">AI Restock Recommendation</h3>
                <p className="text-violet-300 text-xs mt-0.5">Powered by real-time sales velocity analysis</p>
              </div>
            </div>

            {!aiCalculated && (
              <div className="mt-4">
                <p className="text-violet-200 text-sm">
                  Analyze the last 30 days of sales data to calculate the exact restock quantity needed for <strong className="text-white">{product.name}</strong>.
                </p>
                <p className="text-violet-400 text-xs mt-1">
                  Using: Lead Time = {settings.leadTimeDays || 5} days, Safety Stock = {settings.safetyStock || 5} units
                </p>
              </div>
            )}

            {aiCalculated && aiResult && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                  <p className="text-violet-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Daily Sales</p>
                  <p className="text-white text-xl font-black">{aiResult.dailySales}</p>
                  <p className="text-violet-400 text-[10px]">units/day</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                  <p className="text-violet-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Current Stock</p>
                  <p className={`text-xl font-black ${isCritical ? "text-red-400" : isWarning ? "text-orange-400" : "text-white"}`}>{product.stock}</p>
                  <p className="text-violet-400 text-[10px]">units</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                  <p className="text-violet-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Recommended</p>
                  <p className="text-white text-xl font-black">{aiResult.recommendedStock}</p>
                  <p className="text-violet-400 text-[10px]">optimal units</p>
                </div>
                <div className="bg-emerald-500/20 backdrop-blur rounded-xl p-3 border border-emerald-400/30">
                  <p className="text-emerald-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Restock Now</p>
                  <p className="text-emerald-300 text-xl font-black">+{aiResult.suggestedRestockQty}</p>
                  <p className="text-emerald-400 text-[10px]">units</p>
                </div>
              </div>
            )}

            {aiCalculated && aiResult && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${aiResult.dataSource === "sales" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {aiResult.dataSource === "sales" ? `📊 Based on ${aiResult.totalSoldInPeriod} units sold in ${aiResult.lookbackDays} days` : "⚠️ No sales data — using threshold fallback"}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 min-w-[160px]">
            <button
              onClick={runAIAnalysis}
              disabled={aiLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 shadow-lg shadow-violet-900/50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {aiLoading ? "Analyzing..." : aiCalculated ? "Re-Analyze" : "Run Analysis"}
            </button>

            {isAdmin && aiCalculated && aiResult && aiResult.suggestedRestockQty > 0 && (
              <button
                onClick={applyAIRestock}
                disabled={aiApplying}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 shadow-lg shadow-emerald-900/40"
              >
                {aiApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {aiApplying ? "Applying..." : `Apply +${aiResult.suggestedRestockQty}`}
              </button>
            )}

            {!isAdmin && aiCalculated && (
              <p className="text-violet-400 text-xs text-center">Contact Admin to apply restock.</p>
            )}

            {aiCalculated && (
              <button
                onClick={() => { setAiCalculated(false); setAiResult(null); }}
                className="flex items-center justify-center gap-2 px-5 py-2 text-violet-300 hover:text-white text-sm transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Technical Specifications */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle><FileText className="w-4 h-4 text-blue-500" /> Technical Specifications</CardTitle>
        </CardHeader>
        <div className="p-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Brand</dt>
              <dd className="text-base font-medium text-slate-900">{product.brand}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</dt>
              <dd className="text-base font-medium text-slate-900">{product.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">SKU ID</dt>
              <dd className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">{sku}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Stock Status</dt>
              <dd><Badge variant={isCritical ? "danger" : isWarning ? "warning" : "success"}>{isCritical ? "Out of Stock" : isWarning ? "Low Stock" : "In Stock"}</Badge></dd>
            </div>
          </div>
          <div className="p-6">
            <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Product Description</dt>
            <dd className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-4 py-1">
              {product.description || "No description available."}
            </dd>
          </div>
        </div>
      </Card>

      {/* Product Description */}
      <Card>
        <CardContent>
          <CardTitle className="tracking-widest uppercase text-[10px] font-bold text-slate-500 mb-4">
             Product Narrative
          </CardTitle>
          <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-slate-100 pl-6 py-2">
             {product.description || "Detailed technical description not provided for this SKU."}
          </p>
        </CardContent>
      </Card>

      {/* Edit Modal — Admin only */}
      <AnimatePresence>
        {isEditing && isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900">Edit Product</h2>
                <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Selling Price ({currency})</label>
                  <input type="number" step="0.01" required value={editFormData.price}
                    onChange={e => setEditFormData({...editFormData, price: Number(e.target.value)})}
                    className="w-full border border-slate-200 rounded-lg py-2 px-3 focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Stock</label>
                  <input type="number" required value={editFormData.stock}
                    onChange={e => setEditFormData({...editFormData, stock: Number(e.target.value)})}
                    className="w-full border border-slate-200 rounded-lg py-2 px-3 focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier Name</label>
                  <input type="text" value={editFormData.supplierName}
                    onChange={e => setEditFormData({...editFormData, supplierName: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg py-2 px-3 focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                  <textarea rows={4} required value={editFormData.description}
                    onChange={e => setEditFormData({...editFormData, description: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg py-2 px-3 focus:ring-primary focus:border-primary resize-none" />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
