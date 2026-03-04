"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth, type AppUser, type AppUserRole } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = cred.user;

      // Fetch role/profile from Firestore users collection
      const ref = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(ref);

      let profile: AppUser;

      if (snap.exists()) {
        const data = snap.data() as {
          fullName?: string;
          email?: string;
          role?: AppUserRole;
          department?: string;
        };

        profile = {
          uid: firebaseUser.uid,
          email: data.email ?? firebaseUser.email ?? "",
          fullName: data.fullName ?? firebaseUser.displayName ?? "",
          role: data.role ?? "employee",
          department: data.department ?? ""
        };
      } else {
        profile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          fullName: firebaseUser.displayName ?? "",
          role: "employee",
          department: ""
        };
      }

      setUser(profile);
      router.push("/dashboard");
    } catch (err: unknown) {
      let message = "Unable to sign in. Please try again.";
      if (typeof err === "object" && err && "code" in err) {
        const code = (err as { code?: string }).code ?? "";
        if (code === "auth/user-not-found") {
          message = "No user found with that email address.";
        } else if (code === "auth/wrong-password") {
          message = "Incorrect password. Please try again.";
        } else if (code === "auth/invalid-email") {
          message = "The email address is not valid.";
        }
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-logo">ef</div>
          <div>
            <h1 className="auth-title">ExpenseFlow</h1>
            <p className="auth-subtitle">Sign in to your workspace</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </label>

          <label className="auth-label">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

