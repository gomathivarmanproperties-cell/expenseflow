"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const publicRoutes = ["/", "/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Don't show layout for public routes or when loading
  if (publicRoutes.includes(pathname) || loading || !user) {
    return <>{children}</>;
  }

  // Extract current page name from pathname
  const currentPage = pathname.split("/")[1] || "dashboard";

  return (
    <div 
      className="flex flex-row min-h-screen"
      style={{ backgroundColor: "#f0fdf4" }}
    >
      {/* Sidebar - Fixed 240px width */}
      <Sidebar />
      
      {/* Right Side - Full width with column direction */}
      <div className="flex flex-col flex-1 ml-[240px]">
        {/* TopBar - Height 64px */}
        <TopBar currentPage={currentPage} />
        
        {/* Page Content - Below TopBar with padding */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
