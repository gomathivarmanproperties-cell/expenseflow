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
  IndianRupee, 
  FileText,
  FileBarChart,
  User,
  Settings,
  FolderOpen,
  Users as Users2
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Expense Reports", href: "/expense-reports", icon: FileBarChart },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Budgets", href: "/budgets", icon: IndianRupee },
  { name: "Projects", href: "/projects", icon: FolderOpen, roles: ["admin", "manager", "finance"] },
  { name: "Audit Trail", href: "/audit-trail", icon: FileText },
  { name: "Users", href: "/users", icon: Users, adminOnly: true },
];

const bottomNavItems = [
  { name: "My Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];

const roleAccess = {
  employee: ["dashboard", "expenses", "expense-reports"],
  manager: ["dashboard", "expenses", "expense-reports", "vendors", "budgets", "audit-trail"],
  finance: ["dashboard", "expenses", "expense-reports", "vendors", "budgets", "audit-trail"],
  admin: ["dashboard", "expenses", "expense-reports", "vendors", "budgets", "audit-trail"],
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

  // Company branding state
  const [companyBranding, setCompanyBranding] = useState({
    appName: "ExpenseFlow",
    appLogoURL: "",
    fontFamily: "Inter"
  });

  // Default role access as fallback
  const defaultRoleAccess = {
    employee: ["dashboard", "expenses", "expense-reports"],
    manager: ["dashboard", "expenses", "expense-reports", "vendors", "budgets", "projects", "audit-trail"],
    finance: ["dashboard", "expenses", "expense-reports", "vendors", "budgets", "projects", "audit-trail"],
    admin: ["dashboard", "expenses", "expense-reports", "vendors", "budgets", "projects", "audit-trail", "users", "settings"],
  };

  // Default module access structure (same as settings page)
  const defaultModuleAccess = {
    expenses: { employee: true, manager: true, finance: true },
    "expense-reports": { employee: true, manager: true, finance: true },
    vendors: { employee: false, manager: true, finance: true },
    budgets: { employee: false, manager: true, finance: true },
    projects: { employee: false, manager: true, finance: true },
    auditTrail: { employee: false, manager: true, finance: true }
  };

  const [moduleAccess, setModuleAccess] = useState(defaultRoleAccess[user?.role || "employee"] || []);

  // Listen for real-time module access updates from Firestore
  useEffect(() => {
    if (!user) return;

    const userRole = user?.role || "employee";
    
    // Admin always sees everything, skip Firestore module config
    if (userRole === "admin") {
      setModuleAccess(["dashboard", "expenses", "vendors", "budgets", "projects", "audit-trail", "users", "settings"]);
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
          projects: accessData.projects?.[userRole] || defaultModuleAccess.projects[userRole as keyof typeof defaultModuleAccess.projects],
          auditTrail: accessData.auditTrail?.[userRole] || defaultModuleAccess.auditTrail[userRole as keyof typeof defaultModuleAccess.auditTrail],
        };

        // Build allowed pages array based on module access
        const allowedPages = [];
        if (roleAccessFromDB.expenses) allowedPages.push("expenses");
        if (roleAccessFromDB.vendors) allowedPages.push("vendors");
        if (roleAccessFromDB.budgets) allowedPages.push("budgets");
        if (roleAccessFromDB.projects) allowedPages.push("projects");
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
        if (defaultAccess.projects[userRole as keyof typeof defaultAccess.projects]) allowedPages.push("projects");
        if (defaultAccess.auditTrail[userRole as keyof typeof defaultAccess.auditTrail]) allowedPages.push("audit-trail");
        
        // Always include dashboard
        allowedPages.push("dashboard");
        
        setModuleAccess(allowedPages);
      }
    });

    return unsubscribe;
  }, [user]);

  // Listen for company branding updates from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "appConfig", "company"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCompanyBranding({
          appName: data.appName || "ExpenseFlow",
          appLogoURL: data.appLogoURL || "",
          fontFamily: data.fontFamily || "Inter"
        });
      }
    });

    return unsubscribe;
  }, []);

  // Show all nav items while loading, filter by role after auth loads
  const filteredNavItems = loading 
    ? navigationItems 
    : navigationItems.filter(item => {
        const pageName = item.href.replace("/", "");
        
        // Check admin-only items
        if (item.adminOnly && user?.role !== "admin") return false;
        
        // Check role-based items
        if (item.roles && !item.roles.includes(user?.role || "")) return false;
        
        // Check module access
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
        zIndex: 40,
        fontFamily: companyBranding.fontFamily
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
          {/* App Logo or EF mark */}
          {companyBranding.appLogoURL ? (
            <img 
              src={companyBranding.appLogoURL} 
              alt="App Logo" 
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                border: "2px solid #f59e0b",
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
                objectFit: "cover"
              }}
            />
          ) : (
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
          )}
          
          {/* App Name */}
          <span style={{ 
            color: "white", 
            fontSize: "20px", 
            fontWeight: "600",
            fontFamily: companyBranding.fontFamily,
            letterSpacing: "-0.02em"
          }}>
            {companyBranding.appName}
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
    </div>
  );
}
