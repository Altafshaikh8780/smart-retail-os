import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import "dotenv/config";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function createAuthUser() {
  try {
    const email = "admin@qa.sros";
    const password = "password123";
    console.log(`Creating Auth user: ${email}...`);
    await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    console.log("✅ Auth user created successfully!");
    process.exit(0);
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      console.log("ℹ️ Auth user already exists.");
      process.exit(0);
    }
    console.error("❌ Auth user creation failed:", error);
    process.exit(1);
  }
}

createAuthUser();
