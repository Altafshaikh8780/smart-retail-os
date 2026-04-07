import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, addDoc, serverTimestamp, collection, query, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import "dotenv/config";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function cleanData() {
    console.log("Cleaning old test data...");
    const collections = ["products", "inventory", "customers", "employees", "orders", "invoices", "notifications"];
    for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        console.log(`Deleting ${snap.size} docs from ${col}...`);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}

async function seedAdmin() {
    const email = "admin@qa.sros";
    const password = "password123";
    console.log(`Creating/Syncing Admin: ${email}...`);
    
    let uid = "";
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCred.user.uid;
        console.log(`✅ Auth user created: ${uid}`);
    } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
            // We need the UID. Let's sign in to get it.
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            uid = userCred.user.uid;
            console.log(`ℹ️ Auth user exists. UID: ${uid}`);
        } else {
            throw error;
        }
    }

    // Create/Update the Admin employee doc with the CORRECT UID
    await setDoc(doc(db, "employees", uid), {
        uid,
        authUid: uid,
        name: "QA Administrator",
        email: email,
        role: "Admin",
        permissions: ["all"],
        status: "Active",
        phone: "+1-800-ADMIN",
        avatarInitials: "AD",
        salesPerformance: 0,
        targetHit: false,
        createdAt: serverTimestamp()
    });
    
    await signOut(auth);
    return uid;
}

const CATEGORIES = ["Phones", "Laptops", "Tablets", "Accessories", "Small Electronics", "Second-hand"];
const BRANDS = ["Apple", "Samsung", "Dell", "HP", "Sony", "Logitech", "Xiaomi", "OnePlus"];
const randomInRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

async function seedProducts(count: number) {
    console.log(`Seeding ${count} products...`);
    for (let i = 1; i <= count; i++) {
        const brand = randomItem(BRANDS);
        const category = randomItem(CATEGORIES);
        const costPrice = randomInRange(50, 1000);
        const price = Math.round(costPrice * 1.3);
        const stock = i <= 5 ? 0 : (i <= 15 ? randomInRange(1, 5) : randomInRange(10, 100));
        
        const productName = `${brand} ${category} Model X${i}`;
        const sku = `${brand.slice(0,3).toUpperCase()}-${randomInRange(10000, 99999)}`;

        const productData = {
            name: productName,
            brand,
            category,
            price,
            costPrice,
            stock,
            minStock: 5,
            description: `High-quality ${category} from ${brand}. This unit features state-of-the-art technology and premium design for the modern user.`,
            sku,
            supplierId: `SUP-${randomInRange(100, 999)}`,
            images: [],
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "products"), productData);
        await addDoc(collection(db, "inventory"), {
            productId: docRef.id,
            name: productName,
            stock,
            minStock: 5,
            purchasePrice: costPrice,
            sellingPrice: price,
            lastUpdated: serverTimestamp()
        });
    }
}

async function seedCustomers(count: number) {
    console.log(`Seeding ${count} customers...`);
    for (let i = 1; i <= count; i++) {
        await addDoc(collection(db, "customers"), {
            name: `Test Customer ${i}`,
            phone: `+1-${randomInRange(100, 999)}-${randomInRange(1000, 9999)}`,
            email: `customer${i}@example.qa`,
            address: `${randomInRange(1, 999)} Mock Lane, QA Hub`,
            loyaltyTier: randomItem(["Regular", "VIP", "Wholesale"]),
            totalPurchases: randomInRange(0, 50),
            createdAt: serverTimestamp()
        });
    }
}

async function run() {
    try {
        await cleanData();
        await seedAdmin();
        await seedProducts(60);
        await seedCustomers(40);
        console.log("🚀 FULL QA ENVIRONMENT READY!");
        process.exit(0);
    } catch (err) {
        console.error("FAILED:", err);
        process.exit(1);
    }
}

run();
