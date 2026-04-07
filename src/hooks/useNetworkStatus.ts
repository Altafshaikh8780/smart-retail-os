import { useState, useEffect } from "react";
import { enableNetwork, disableNetwork } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      try {
        await enableNetwork(db);
        toast.success("Back online — changes synced automatically.", {
          icon: "✅",
          id: "network-status",
        });
      } catch (e) {
        console.error("Failed to re-enable Firestore network:", e);
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      try {
        await disableNetwork(db);
        toast("You're offline — edits saved locally and will sync automatically.", {
          icon: "📡",
          id: "network-status",
          duration: 5000,
        });
      } catch (e) {
        console.error("Failed to disable Firestore network:", e);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
};
