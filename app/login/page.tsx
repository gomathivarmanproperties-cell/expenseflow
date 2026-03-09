"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth, type AppUser, type AppUserRole } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, user } = useAuth();

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    console.log("=== LOGIN ATTEMPT START ===");
    console.log("Email:", email);
    console.log("Password provided:", password ? "Yes" : "No");

    try {
      console.log("Step 1: Attempting Firebase auth...");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = cred.user;
      
      console.log("Step 1 SUCCESS: Firebase auth successful");
      console.log("User UID:", firebaseUser.uid);
      console.log("User email:", firebaseUser.email);
      console.log("User display name:", firebaseUser.displayName);

      console.log("Step 2: Fetching user profile from Firestore...");
      // Fetch role/profile from Firestore users collection
      const ref = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(ref);
      
      console.log("Step 2: Firestore query completed");
      console.log("Document exists:", snap.exists());
      console.log("Document ID:", snap.id);

      let profile: AppUser;

      if (snap.exists()) {
        console.log("Step 3: User document found in Firestore");
        const data = snap.data() as {
          fullName?: string;
          email?: string;
          role?: AppUserRole;
          department?: string;
        };

        console.log("Firestore user data:", data);

        profile = {
          uid: firebaseUser.uid,
          email: data.email ?? firebaseUser.email ?? "",
          fullName: data.fullName ?? firebaseUser.displayName ?? "",
          role: data.role ?? "employee",
          department: data.department ?? ""
        };

        console.log("Step 3: Profile created from Firestore data");
      } else {
        console.log("Step 3: No user document found in Firestore, creating default profile");
        profile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          fullName: firebaseUser.displayName ?? "",
          role: "employee",
          department: ""
        };

        console.log("Step 3: Default profile created");
      }

      console.log("Final profile:", profile);

      console.log("Step 4: Setting user in AuthProvider...");
      setUser(profile);
      
      console.log("Step 5: Creating session token...");
      // Create session with uid and role
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          uid: profile.uid, 
          role: profile.role 
        }),
      });

      console.log("Step 5: Session response status:", sessionResponse.status);
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.text();
        console.error("Session creation failed:", errorData);
        throw new Error(`Session creation failed: ${errorData}`);
      }

      console.log("Step 5: Session created successfully");
      
      console.log("=== LOGIN SUCCESS ===");
      console.log("Redirecting to dashboard...");
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("=== LOGIN ERROR ===");
      console.error("Full error object:", err);
      
      if (typeof err === "object" && err !== null) {
        console.error("Error type:", typeof err);
        console.error("Error keys:", Object.keys(err));
        
        if ("code" in err) {
          console.error("Firebase error code:", (err as { code?: string }).code);
        }
        
        if ("message" in err) {
          console.error("Firebase error message:", (err as { message?: string }).message);
        }
        
        if ("name" in err) {
          console.error("Firebase error name:", (err as { name?: string }).name);
        }
      } else {
        console.error("Error is not an object:", typeof err);
        console.error("Error value:", err);
      }
      
      let message = "Unable to sign in. Please try again.";
      if (typeof err === "object" && err && "code" in err) {
        const code = (err as { code?: string }).code ?? "";
        console.error("Handling known Firebase error code:", code);
        
        if (code === "auth/user-not-found") {
          message = "No user found with that email address.";
        } else if (code === "auth/wrong-password") {
          message = "Incorrect password. Please try again.";
        } else if (code === "auth/invalid-email") {
          message = "The email address is not valid.";
        } else {
          // Catch-all for other Firebase errors
          message = `Authentication error: ${code}`;
        }
      } else {
        // Catch-all for non-Firebase errors
        message = `Login failed: ${String(err)}`;
      }
      
      console.error("Final error message to user:", message);
      setError(message);
    } finally {
      setSubmitting(false);
      console.log("=== LOGIN ATTEMPT END ===");
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

