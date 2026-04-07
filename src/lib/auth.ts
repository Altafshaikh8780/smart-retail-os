import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase";

export const login = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);

export { useAuth } from "./AuthContext";
