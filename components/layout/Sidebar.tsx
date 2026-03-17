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
    admin: ["dashboard", "expenses", "vendors", "budgets", "audit-trail", "settings"],
  };

  // Default module access structure (same as settings page)
  const defaultModuleAccess = {
    expenses: { employee: true, manager: true, finance: true },
    vendors: { employee: false, manager: true, finance: true },
    budgets: { employee: false, manager: true, finance: true },
    auditTrail: { employee: false, manager: true, finance: true }
  };

  const [moduleAccess, setModuleAccess] = useState(defaultRoleAccess[user?.role || "employee"] || []);

  // Admin always sees everything, skip Firestore module config
  if (user?.role === "admin") {
    setModuleAccess(["dashboard", "expenses", "vendors", "budgets", "audit-trail", "settings"]);
  }

  // Listen for real-time module access updates from Firestore
  useEffect(() => {
    if (!user) return;

    const userRole = user?.role || "employee";
    
    // Admin always sees everything, skip Firestore module config
    if (userRole === "admin") {
      setModuleAccess(["dashboard", "expenses", "vendors", "budgets", "audit-trail", "settings"]);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "appConfig", "moduleAccess"), (doc) => {
      if (doc.exists()) {
        const accessData = doc.data();
        const userRole = user?.role || "employee";
        
        // Convert Firestore data to role access format
        const roleAccessFromDB = {
          expenses: accessData.expenses?.[userRole] || defaultModuleAccess.expenses[userRole as keyof typeof defaultModuleAccess.expenses],
          vendors: accessData.vendors?.[userRole] || defaultModuleAccess.vendors[userRole as keyof typeof defaultModuleAccess.vendors],
          budgets: accessData.budgets?.[userRole] || defaultModuleAccess.budgets[userRole as keyof typeof defaultModuleAccess.budgets],
          auditTrail: accessData.auditTrail?.[userRole] || defaultModuleAccess.auditTrail[userRole as keyof typeof defaultModuleAccess.auditTrail],
        };

        // Build allowed pages array based on module access
        const allowedPages = [];
        if (roleAccessFromDB.expenses) allowedPages.push("expenses");
        if (roleAccessFromDB.vendors) allowedPages.push("vendors");
        if (roleAccessFromDB.budgets) allowedPages.push("budgets");
        if (roleAccessFromDB.auditTrail) allowedPages.push("audit-trail");
        
        // Always include dashboard
        allowedPages.push("dashboard");
        
        setModuleAccess(allowedPages);
      } else {
        // Use default module access if doc doesn't exist
        const userRole = user?.role || "employee";
        const defaultAccess = defaultModuleAccess;
        
        const allowedPages = [];
        if (defaultAccess.expenses[userRole as keyof typeof defaultAccess.expenses]) allowedPages.push("expenses");
        if (defaultAccess.vendors[userRole as keyof typeof defaultAccess.vendors]) allowedPages.push("vendors");
        if (defaultAccess.budgets[userRole as keyof typeof defaultAccess.budgets]) allowedPages.push("budgets");
        if (defaultAccess.auditTrail[userRole as keyof typeof defaultAccess.auditTrail]) allowedPages.push("audit-trail");
        
        // Always include dashboard
        allowedPages.push("dashboard");
        
        setModuleAccess(allowedPages);
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
          height: "80px",
          borderBottom: "1px solid rgba(245, 158, 11, 0.2)",
          display: "flex",
          alignItems: "center",
          paddingLeft: "20px",
          paddingRight: "20px",
          background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* EF mark in gold on slightly lighter green */}
          <div 
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "#065f46",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              border: "2px solid #f59e0b",
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)"
            }}
          >
            <span style={{ color: "#f59e0b", fontSize: "16px", fontWeight: "700", letterSpacing: "0.05em" }}>EF</span>
          </div>
          
          {/* "ExpenseFlow" in Instrument Serif, white, elegant */}
          <span style={{ 
            color: "white", 
            fontSize: "20px", 
            fontWeight: "600",
            fontFamily: "'Instrument Serif', Georgia, serif",
            letterSpacing: "-0.02em"
          }}>
            ExpenseFlow
          </span>
        </div>
      </div>

      {/* MIDDLE SECTION - Navigation */}
      <div style={{ flex: 1, padding: "20px 16px" }}>
        {/* Navigation Label */}
        <div style={{
          color: "#f59e0b",
          fontSize: "10px",
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "16px",
          opacity: 0.8
        }}>
          Navigation
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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
                  padding: "12px 16px",
                  borderRadius: "10px",
                  backgroundColor: isActive ? "#065f46" : "transparent",
                  color: loading ? "rgba(255, 255, 255, 0.4)" : "white",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.15s ease",
                  borderLeft: isActive ? "3px solid #f59e0b" : "3px solid transparent",
                  paddingLeft: isActive ? "13px" : "16px"
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !loading) {
                    e.currentTarget.style.backgroundColor = "#065f46";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.opacity = "1";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !loading) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.opacity = "1";
                  }
                }}
              >
                <Icon 
                  size={18} 
                  style={{ 
                    flexShrink: 0,
                    opacity: loading ? 0.4 : (isActive ? 1 : 0.4),
                    color: isActive ? "#f59e0b" : "inherit"
                  }} 
                />
                <span style={{
                  color: isActive ? "#f59e0b" : "inherit",
                  fontWeight: isActive ? "600" : "500"
                }}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* BOTTOM SECTION - User Card */}
      <div 
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "16px",
          background: "rgba(0, 0, 0, 0.15)",
          backdropFilter: "blur(10px)"
        }}
      >
        {/* User Profile Card */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px",
          borderRadius: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          transition: "all 0.2s ease",
          cursor: "pointer"
        }}
        onClick={() => window.location.href = "/profile"}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
        >
          {/* Avatar with gold ring */}
          <div style={{
            position: "relative",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "600",
            fontSize: "14px",
            border: "2px solid #f59e0b",
            boxShadow: "0 0 0 4px rgba(245, 158, 11, 0.2)"
          }}>
            {getInitials(user?.fullName || user?.email || "User")}
          </div>
          
          {/* User Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: "white",
              fontSize: "14px",
              fontWeight: "500",
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {user?.fullName || user?.email?.split("@")[0] || "User"}
            </div>
            <div style={{
              color: "#6ee7b7",
              fontSize: "12px",
              fontWeight: "400",
              opacity: 0.9
            }}>
              {roleDisplayName}
              {user?.department && ` • ${String(user.department)}`}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "12px" }}>
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
                  backgroundColor: isActive ? "#065f46" : "transparent",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: "500",
                  transition: "all 0.15s ease",
                  borderLeft: isActive ? "3px solid #f59e0b" : "3px solid transparent",
                  paddingLeft: isActive ? "13px" : "16px",
                  opacity: loading ? 0.4 : 1
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
                <Icon 
                  size={16} 
                  style={{ 
                    flexShrink: 0,
                    opacity: loading ? 0.4 : (isActive ? 1 : 0.4),
                    color: isActive ? "#f59e0b" : "inherit"
                  }} 
                />
                <span style={{
                  color: isActive ? "#f59e0b" : "inherit",
                  fontWeight: isActive ? "600" : "500"
                }}>{item.name}</span>
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
                {String(user.designation)}
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
