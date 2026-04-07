import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import "dotenv/config";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS_TO_WIPE = [
  "products",
  "inventory",
  "customers",
  "employees",
  "orders",
  "invoices",
  "notifications",
  "returns"
];

async function resetSystem() {
  console.log("🚀 Starting Full System Reset...");
  
  for (const colName of COLLECTIONS_TO_WIPE) {
    try {
      const colRef = collection(db, colName);
      const snap = await getDocs(colRef);
      
      if (snap.empty) {
        console.log(`- ${colName}: Already empty.`);
        continue;
      }

      console.log(`- ${colName}: Deleting ${snap.size} documents...`);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`  ✅ ${colName} wiped.`);
    } catch (error: any) {
      console.error(`  ❌ Failed to wipe ${colName}:`, error.message);
    }
  }

  console.log("\n✨ System reset to 0. All business data cleared.");
  process.exit(0);
}

resetSystem();
