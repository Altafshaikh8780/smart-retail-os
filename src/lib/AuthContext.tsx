import React, { createContext, useContext, useEffect, useState } from "react";
import { type User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { type Permission, resolvePermissions } from "./permissions";

interface AuthContextType {
  user: User | null;
  role: string | null;
  permissions: Permission[];
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  permissions: [],
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, "employees", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const fetchedRole: string | null = data.role || null;
            const storedPerms: string[] | null = data.permissions || null;
            const resolved = resolvePermissions(fetchedRole, storedPerms);
            setRole(fetchedRole);
            setPermissions(resolved);
          } else {
            setRole(null);
            setPermissions([]);
          }
        } catch (err) {
          console.error("Failed to fetch user role/permissions", err);
          setRole(null);
          setPermissions([]);
        }
      } else {
        setRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, permissions, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
