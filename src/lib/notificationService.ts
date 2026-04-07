import { db } from "./firebase";
import { collection, doc, serverTimestamp, WriteBatch, addDoc } from "firebase/firestore";

type NotificationType = 'low_stock' | 'new_order' | 'return';

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
}

/**
 * Adds a notification write operation to an existing Firestore batch.
 * This guarantees atomic notifications alongside inventory or order updates.
 */
export const addNotificationToBatch = (batch: WriteBatch, payload: NotificationPayload) => {
  const notifRef = doc(collection(db, "notifications"));
  batch.set(notifRef, {
    ...payload,
    read: false,
    createdAt: serverTimestamp()
  });
};

/**
 * Creates a standalone notification when a batch is not required.
 */
export const createNotification = async (payload: NotificationPayload) => {
  await addDoc(collection(db, "notifications"), {
    ...payload,
    read: false,
    createdAt: serverTimestamp()
  });
};
