"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  DollarSign, 
  FileText,
  User,
  Settings
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Budgets", href: "/budgets", icon: DollarSign },
  { name: "Audit Trail", href: "/audit-trail", icon: FileText },
];

const bottomNavItems = [
  { name: "My Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];

const roleAccess = {
  employee: ["dashboard", "expenses"],
  manager: ["dashboard", "expenses", "vendors", "budgets", "audit-trail"],
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
  const { user, loading } = useAuth();

  // Default role access as fallback
  const defaultRoleAccess = {
    employee: ["dashboard", "expenses"],
    manager: ["dashboard", "expenses", "vendors", "budgets", "audit-trail"],
    finance: ["dashboard", "expenses", "vendors", "budgets", "audit-trail"],
    admin: ["dashboard", "expenses", "vendors", "budgets", "audit-trail"],
  };

  const [moduleAccess, setModuleAccess] = useState(defaultRoleAccess[user?.role || "employee"] || []);

  // Listen for real-time module access updates from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "appConfig", "moduleAccess"), (doc) => {
      if (doc.exists()) {
        const accessData = doc.data();
        const userRole = user?.role || "employee";
        
        // Convert Firestore data to role access format
        const roleAccessFromDB = {
          expenses: accessData.expenses?.[userRole] || defaultRoleAccess[userRole].includes("expenses"),
          vendors: accessData.vendors?.[userRole] || defaultRoleAccess[userRole].includes("vendors"),
          budgets: accessData.budgets?.[userRole] || defaultRoleAccess[userRole].includes("budgets"),
          auditTrail: accessData.auditTrail?.[userRole] || defaultRoleAccess[userRole].includes("audit-trail"),
        };

        // Build allowed pages array based on module access
        const allowedPages = [];
        if (roleAccessFromDB.expenses) allowedPages.push("expenses");
        if (roleAccessFromDB.vendors) allowedPages.push("vendors");
        if (roleAccessFromDB.budgets) allowedPages.push("budgets");
        if (roleAccessFromDB.auditTrail) allowedPages.push("audit-trail");
        
        // Always include dashboard
        if (!allowedPages.includes("dashboard")) allowedPages.unshift("dashboard");
        
        setModuleAccess(allowedPages);
      } else {
        // Fallback to default if doc doesn't exist yet
        setModuleAccess(defaultRoleAccess[user?.role || "employee"] || []);
      }
    });

    return unsubscribe;
  }, [user]);

  // Show all nav items while loading, filter by role after auth loads
  const filteredNavItems = loading 
    ? navigationItems 
    : navigationItems.filter(item => {
        const pageName = item.href.replace("/", "");
        return moduleAccess.includes(pageName);
      });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const userRole = user?.role ?? "employee";

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
                  color: loading ? "#6ee7b7" : "white",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background-color 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !loading) {
                    e.currentTarget.style.backgroundColor = "#065f46";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !loading) {
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

      {/* BOTTOM NAVIGATION - Profile & Settings */}
      <div 
        style={{
          borderTop: "1px solid #065f46",
          padding: "16px"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const shouldShow = item.adminOnly ? userRole === "admin" : true;
            
            if (!shouldShow) return null;
            
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
        <Link
          href="/profile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
            color: "white"
          }}
        >
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
              flexShrink: 0,
              overflow: "hidden"
            }}
          >
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            ) : (
              <span style={{ color: "white", fontSize: "14px", fontWeight: "600" }}>
                {getInitials(user?.fullName || "User")}
              </span>
            )}
          </div>
          
          {/* User name, role, and designation */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ color: "white", fontSize: "14px", fontWeight: "500" }}>
              {user?.fullName || "User"}
            </div>
            <div style={{ color: "#6ee7b7", fontSize: "12px" }}>
              {roleDisplayName}
            </div>
            {user?.designation && (
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                {user.designation}
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
