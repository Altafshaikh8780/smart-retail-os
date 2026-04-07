import { create } from "zustand";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface GlobalSettings {
  storeName: string;
  currency: string;
  storeAddress: string;
  gstNumber?: string;
  taxRate?: number;
  leadTimeDays: number;
  safetyStock: number;
}

interface SettingsStore {
  settings: GlobalSettings;
  loading: boolean;
  initialized: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<GlobalSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  storeName: "Smart Retail OS",
  currency: "₹",
  storeAddress: "123 Business Avenue, Tech District",
  gstNumber: "",
  taxRate: 18,
  leadTimeDays: 5,
  safetyStock: 5,
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,
  initialized: false,

  fetchSettings: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as GlobalSettings;
        set({ settings: { ...DEFAULT_SETTINGS, ...data }, initialized: true });
      } else {
        await setDoc(docRef, DEFAULT_SETTINGS);
        set({ settings: DEFAULT_SETTINGS, initialized: true });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (newSettings) => {
    const current = get().settings;
    const updated = { ...current, ...newSettings };
    try {
      const docRef = doc(db, "settings", "global");
      await setDoc(docRef, updated, { merge: true });
      set({ settings: updated });
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
    }
  },
}));
