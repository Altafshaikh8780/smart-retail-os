/**
 * AI Restock Engine
 * Calculates optimal restock quantities based on sales velocity, lead time, and safety stock.
 */
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface AIRestockResult {
  dailySales: number;
  recommendedStock: number;
  currentStock: number;
  suggestedRestockQty: number;
  lookbackDays: number;
  totalSoldInPeriod: number;
  dataSource: "sales" | "fallback";
}

export interface AIRestockConfig {
  leadTimeDays: number;
  safetyStock: number;
  lookbackDays: number;
  maxRestockCap: number;
}

const DEFAULT_CONFIG: AIRestockConfig = {
  leadTimeDays: 5,
  safetyStock: 5,
  lookbackDays: 7,
  maxRestockCap: 100,
};

/**
 * Calculate AI-based restock recommendation for a product.
 */
export async function calculateRestockRecommendation(
  productId: string,
  currentStock: number,
  minThreshold: number,
  config: Partial<AIRestockConfig> = {}
): Promise<AIRestockResult> {
  const { leadTimeDays, safetyStock, lookbackDays, maxRestockCap } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startTimestamp = Timestamp.fromDate(startDate);

  let totalSold = 0;
  let dataSource: "sales" | "fallback" = "fallback";

  try {
    // Query orders within the date range that contain this product
    const ordersQuery = query(
      collection(db, "orders"),
      where("createdAt", ">=", startTimestamp)
    );
    const snap = await getDocs(ordersQuery);

    snap.forEach((doc) => {
      const data = doc.data();
      const lineItems: any[] = data.lineItems || data.items || [];
      lineItems.forEach((item: any) => {
        if (item.productId === productId || item.id === productId) {
          const qty = Number(item.quantity || item.qty || 0);
          totalSold += qty;
        }
      });
    });

    if (totalSold > 0) dataSource = "sales";
  } catch (err) {
    console.warn("[AIRestock] Error fetching sales data:", err);
  }

  const dailySales = totalSold > 0 ? totalSold / lookbackDays : 0;

  let suggestedRestockQty: number;

  if (totalSold === 0) {
    // Fallback: restock to threshold
    suggestedRestockQty = Math.max(0, minThreshold - currentStock);
  } else {
    const recommendedStock = Math.ceil(dailySales * leadTimeDays) + safetyStock;
    suggestedRestockQty = Math.max(0, recommendedStock - currentStock);
  }

  // Cap to prevent overstock
  suggestedRestockQty = Math.min(suggestedRestockQty, maxRestockCap);

  const recommendedStock =
    dataSource === "sales"
      ? Math.ceil(dailySales * leadTimeDays) + safetyStock
      : minThreshold;

  return {
    dailySales: parseFloat(dailySales.toFixed(2)),
    recommendedStock,
    currentStock,
    suggestedRestockQty,
    lookbackDays,
    totalSoldInPeriod: totalSold,
    dataSource,
  };
}
