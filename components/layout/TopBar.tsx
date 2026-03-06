"use client";

import { useAuth } from "@/components/auth/AuthProvider";

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

export function TopBar({ currentPage }: { currentPage: string }) {
  const { user } = useAuth();

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const roleColor = roleBadgeColors[user.role as keyof typeof roleBadgeColors] || roleBadgeColors.employee;
  const roleDisplayName = roleDisplayNames[user.role as keyof typeof roleDisplayNames] || "Employee";

  // Format page name for display
  const formatPageName = (page: string) => {
    return page
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div 
      style={{
        height: "64px",
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "24px",
        paddingRight: "24px"
      }}
    >
      {/* LEFT - Current page name */}
      <div>
        <h1 
          style={{ 
            fontSize: "20px", 
            fontWeight: "600", 
            color: "#111827",
            margin: 0
          }}
        >
          {formatPageName(currentPage)}
        </h1>
      </div>

      {/* RIGHT - Role badge + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Role badge */}
        <div 
          style={{
            backgroundColor: roleColor.backgroundColor,
            color: roleColor.color,
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: "600"
          }}
        >
          {roleDisplayName}
        </div>

        {/* Avatar circle with initials */}
        <div 
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <span style={{ color: "white", fontSize: "14px", fontWeight: "600" }}>
            {getInitials(user.fullName)}
          </span>
        </div>
      </div>
    </div>
  );
}
