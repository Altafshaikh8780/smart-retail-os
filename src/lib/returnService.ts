import { db } from "./firebase";
import { collection, doc, query, where, getDocs, writeBatch, increment, serverTimestamp, deleteDoc } from "firebase/firestore";
import { addNotificationToBatch } from "./notificationService";

export const deleteReturnRecord = async (docId: string) => {
  await deleteDoc(doc(db, "returns", docId));
};

export type ProcessReturnPayload = {
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  customerName: string;
  items: number;
  reason: string;
  refundAmount: number;
  refundMethod: "UPI" | "Card" | "Cash";
  employeeId?: string;
  lineItems?: Array<{ productId: string; name: string; quantity: number }>;
};

export const processReturnTransaction = async (payload: ProcessReturnPayload) => {
  const batch = writeBatch(db);

  // 1. Create return record natively
  const returnRef = doc(collection(db, "returns"));
  batch.set(returnRef, {
    returnId: `RET-${Date.now().toString().slice(-6)}`,
    orderId: payload.orderNumber,
    customer: payload.customerName,
    product: payload.productName,
    reason: payload.reason,
    refundAmount: payload.refundAmount,
    refundMethod: payload.refundMethod,
    refundStatus: "completed",
    processedBy: payload.employeeId || "Admin",
    status: "Processed",
    date: new Date().toISOString().split("T")[0],
    createdAt: serverTimestamp()
  });

  // 2. Safely mutate the exact target Order
  batch.update(doc(db, "orders", payload.orderId), {
    status: "Returned"
  });

  // 3. Atomically restore stock for all target products
  if (payload.lineItems && payload.lineItems.length > 0) {
    for (const item of payload.lineItems) {
      if (!item.productId) continue;
      
      const productRef = doc(db, "products", item.productId);
      batch.update(productRef, {
        stock: increment(item.quantity || 1)
      });

      // Mirror Update in isolated Inventory
      const invQuery = query(collection(db, "inventory"), where("productId", "==", item.productId));
      const invSnap = await getDocs(invQuery);
      if (!invSnap.empty) {
        batch.update(doc(db, "inventory", invSnap.docs[0].id), {
          stock: increment(item.quantity || 1),
          lastUpdated: serverTimestamp()
        });
      }
    }
  } else if (payload.productId) {
    // Fallback for legacy single-item orders
    const productRef = doc(db, "products", payload.productId);
    batch.update(productRef, {
      stock: increment(payload.items)
    });

    const invQuery = query(collection(db, "inventory"), where("productId", "==", payload.productId));
    const invSnap = await getDocs(invQuery);
    if (!invSnap.empty) {
      batch.update(doc(db, "inventory", invSnap.docs[0].id), {
        stock: increment(payload.items),
        lastUpdated: serverTimestamp()
      });
    }
  }

  // 4. Explicitly flip exactly one Device Serial (IMEI record) if applicable 
  // (Note: This still targets the primary payload.productId if available, 
  // but can be scaled in the future for multi-IMEI returns).
  if (payload.productId) {
    const serialQuery = query(collection(db, "device_serials"), where("productId", "==", payload.productId), where("status", "==", "Sold"));
    const serialSnap = await getDocs(serialQuery);
    
    const targetSerialDoc = serialSnap.docs.find(d => d.data().customerName === payload.customerName);
    if (targetSerialDoc) {
      batch.update(doc(db, "device_serials", targetSerialDoc.id), {
        status: "Returned"
      });
    }
  }

  // 6. Push the Centralized Notification payload
  addNotificationToBatch(batch, {
    type: "return",
    title: "Return Issued",
    message: `${payload.productName} returned by ${payload.customerName}`,
    referenceId: returnRef.id
  });

  // Emit
  await batch.commit();
  return returnRef.id;
};
