// v2 - client side auth protection
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Always show loading spinner while checking auth
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0fdf4" }}>
        <div style={{ color: "#10b981", fontSize: 18, fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  // Never show children if user is not authenticated
  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0fdf4" }}>
        <div style={{ color: "#10b981", fontSize: 18, fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  // Only show children when user is authenticated
  return <>{children}</>;
}
