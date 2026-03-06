"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ProtectedRoute } from "../auth/ProtectedRoute";

const publicRoutes = ["/", "/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  const currentPage = pathname.split("/")[1] || "dashboard";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0fdf4" }}>
      
      {/* Sidebar - Fixed on left */}
      <div style={{ position: "fixed", top: 0, left: 0, width: 240, height: "100vh", zIndex: 20 }}>
        <Sidebar />
      </div>

      {/* TopBar - Fixed at top of content area */}
      <div style={{ position: "fixed", top: 0, left: 240, right: 0, height: 64, zIndex: 10 }}>
        <TopBar currentPage={currentPage} />
      </div>

      {/* Main Content - Offset for sidebar and topbar */}
      <main style={{ marginLeft: 240, paddingTop: 64, minHeight: "100vh", padding: "88px 24px 24px 264px" }}>
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </main>

    </div>
  );
}
