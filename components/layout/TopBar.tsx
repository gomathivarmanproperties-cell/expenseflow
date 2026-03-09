"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase"; // adjust if your firebase config is at a different path
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
  const router = useRouter();

  if (!user) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const roleColor = roleBadgeColors[user.role as keyof typeof roleBadgeColors] || roleBadgeColors.employee;
  const roleDisplayName = roleDisplayNames[user.role as keyof typeof roleDisplayNames] || "Employee";

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
        paddingRight: "24px",
      }}
    >
      {/* LEFT - Current page name */}
      <div>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#111827",
            margin: 0,
          }}
        >
          {formatPageName(currentPage)}
        </h1>
      </div>

      {/* RIGHT - Role badge + avatar + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

        {/* Role badge */}
        <div
          style={{
            backgroundColor: roleColor.backgroundColor,
            color: roleColor.color,
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: "600",
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
            justifyContent: "center",
          }}
        >
          <span style={{ color: "white", fontSize: "14px", fontWeight: "600" }}>
            {getInitials(user.fullName)}
          </span>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            backgroundColor: "white",
            color: "#6b7280",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fef2f2";
            (e.currentTarget as HTMLButtonElement).style.color = "#dc2626";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
            (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
          }}
        >
          {/* Logout icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>

      </div>
    </div>
  );
}