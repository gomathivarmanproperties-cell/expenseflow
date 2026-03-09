"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export type AppUserRole = "admin" | "finance" | "manager" | "employee";

export type AppUser = {
  uid: string;
  email: string;
  fullName: string;
  role: AppUserRole;
  department: string;
  designation?: string;
  phone?: string;
  photoURL?: string;
  assignedApproverId?: string;
  assignedApproverName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
} | null;

type AuthContextValue = {
  user: AppUser;
  loading: boolean;
  setUser: (user: AppUser) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUserProfile(firebaseUser: FirebaseUser): Promise<AppUser> {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? "",
      fullName: firebaseUser.displayName ?? "",
      role: "employee",
      department: ""
    };
  }

  const data = snap.data() as {
    fullName?: string;
    email?: string;
    role?: AppUserRole;
    department?: string;
    designation?: string;
    phone?: string;
    photoURL?: string;
    assignedApproverId?: string;
    assignedApproverName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };

  return {
    uid: firebaseUser.uid,
    email: data.email ?? firebaseUser.email ?? "",
    fullName: data.fullName ?? firebaseUser.displayName ?? "",
    role: data.role ?? "employee",
    department: data.department ?? "",
    designation: data.designation,
    phone: data.phone,
    photoURL: data.photoURL,
    assignedApproverId: data.assignedApproverId,
    assignedApproverName: data.assignedApproverName,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    ifscCode: data.ifscCode,
    accountHolderName: data.accountHolderName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchUserProfile(firebaseUser);
        setUser(profile);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

