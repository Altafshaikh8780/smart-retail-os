/**
 * Lightweight Firestore activity logger.
 * Non-blocking — failures are silently caught so they never interrupt user flows.
 */
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type ActivityAction =
  | "order.created"
  | "order.cancelled"
  | "order.returned"
  | "product.added"
  | "product.edited"
  | "product.deleted"
  | "customer.added"
  | "customer.edited"
  | "customer.deleted"
  | "invoice.downloaded"
  | "employee.added"
  | "employee.edited"
  | "employee.deleted"
  | "inventory.restocked"
  | "return.processed"
  | "settings.updated";

interface ActivityPayload {
  action: ActivityAction;
  actorId: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  meta?: Record<string, any>;
}

/**
 * Log a user action to the `activityLogs` Firestore collection.
 * Returns silently on failure — never throws.
 */
export async function logActivity(payload: ActivityPayload): Promise<void> {
  try {
    await addDoc(collection(db, "activityLogs"), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Silent fail — logging must never break user flows
    console.warn("[ActivityLogger] Failed to write log:", err);
  }
}
