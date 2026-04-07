import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import "dotenv/config";

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const email = "admin@qa.sros";
const password = "password123";

async function run() {
    try {
        console.log("Syncing Admin Auth/Firestore...");
        let uid = "";
        try {
            const res = await createUserWithEmailAndPassword(auth, email, password);
            uid = res.user.uid;
        } catch (e: any) {
            if (e.code === "auth/email-already-in-use") {
                const res = await signInWithEmailAndPassword(auth, email, password);
                uid = res.user.uid;
            } else throw e;
        }

        console.log(`UID: ${uid}`);
        await setDoc(doc(db, "employees", uid), {
            uid, authUid: uid, name: "QA Admin", email, role: "Admin", permissions: ["all"], status: "Active", createdAt: serverTimestamp()
        });

        console.log("Seeding base products...");
        for (let i = 1; i <= 20; i++) {
            const p = await addDoc(collection(db, "products"), {
                name: `Apple Phone X${i}`, brand: "Apple", category: "Phones", price: 1000, costPrice: 700, stock: 50, minStock: 5, createdAt: serverTimestamp()
            });
            await addDoc(collection(db, "inventory"), {
                productId: p.id, name: `Apple Phone X${i}`, stock: 50, minStock: 5, purchasePrice: 700, sellingPrice: 1000, lastUpdated: serverTimestamp()
            });
        }
        
        console.log("✅ SEED SUCCESS!");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
