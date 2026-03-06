"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  DollarSign, 
  FileText
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Budgets", href: "/budgets", icon: DollarSign },
  { name: "Audit Trail", href: "/audit-trail", icon: FileText },
];

const roleAccess = {
  employee: ["dashboard", "expenses"],
  manager: ["dashboard", "expenses", "budgets", "audit-trail"],
  finance: ["dashboard", "expenses", "vendors", "budgets", "audit-trail"],
  admin: ["dashboard", "expenses", "vendors", "budgets", "audit-trail"],
};

const roleBadgeColors = {
  admin: { backgroundColor: "#f3e8ff", color: "#7c3aed" },
  finance: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  manager: { backgroundColor: "#fed7aa", color: "#ea580c" },
  employee: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const roleDisplayNames = {
  admin: "Admin",
  finance: "Finance",
  manager: "Manager",
  employee: "Employee",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const userRole = user?.role || "employee";
  const allowedPages = roleAccess[userRole as keyof typeof roleAccess] || [];

  const filteredNavItems = navigationItems.filter(item => {
    const pageName = item.href.replace("/", "");
    return allowedPages.includes(pageName);
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const roleColor = roleBadgeColors[userRole as keyof typeof roleBadgeColors] || roleBadgeColors.employee;
  const roleDisplayName = roleDisplayNames[userRole as keyof typeof roleDisplayNames] || "Employee";

  return (
    <div 
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "240px",
        height: "100vh",
        backgroundColor: "#064e3b",
        display: "flex",
        flexDirection: "column",
        zIndex: 40
      }}
    >
      {/* TOP SECTION - Logo Area */}
      <div 
        style={{
          height: "64px",
          borderBottom: "1px solid #065f46",
          display: "flex",
          alignItems: "center",
          paddingLeft: "16px",
          paddingRight: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Small green square with "EF" */}
          <div 
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px"
            }}
          >
            <span style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>EF</span>
          </div>
          
          {/* "ExpenseFlow" text */}
          <span style={{ color: "white", fontSize: "16px", fontWeight: "600" }}>
            ExpenseFlow
          </span>
        </div>
      </div>

      {/* MIDDLE SECTION - Navigation */}
      <div style={{ flex: 1, padding: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  backgroundColor: isActive ? "#10b981" : "transparent",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background-color 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#065f46";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* BOTTOM SECTION - User Info */}
      <div 
        style={{
          borderTop: "1px solid #065f46",
          padding: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* User avatar circle */}
          <div 
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <span style={{ color: "white", fontSize: "14px", fontWeight: "600" }}>
              {getInitials(user?.fullName || "User")}
            </span>
          </div>
          
          {/* User name and role */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ color: "white", fontSize: "14px", fontWeight: "500" }}>
              {user?.fullName || "User"}
            </div>
            <div style={{ color: "#6ee7b7", fontSize: "12px" }}>
              {roleDisplayName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
