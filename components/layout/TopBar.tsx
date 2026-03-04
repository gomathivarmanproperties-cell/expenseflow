"use client";

import { useAuth } from "@/components/auth/AuthProvider";

const roleBadgeColors = {
  admin: "bg-purple-100 text-purple-800 border-purple-200",
  finance: "bg-blue-100 text-blue-800 border-blue-200", 
  manager: "bg-orange-100 text-orange-800 border-orange-200",
  employee: "bg-gray-100 text-gray-800 border-gray-200",
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

  return (
    <div 
      className="flex items-center justify-between"
      style={{
        backgroundColor: "#ffffff",
        height: "64px",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 24px"
      }}
    >
      {/* Current Page Name on Left */}
      <div>
        <h1 
          className="capitalize"
          style={{ 
            fontSize: "24px", 
            fontWeight: "700", 
            color: "#111827",
            margin: 0
          }}
        >
          {currentPage.replace("-", " ")}
        </h1>
      </div>

      {/* User Role Badge and Avatar on Right */}
      <div className="flex items-center space-x-4">
        {/* Role Badge */}
        <div className={`
          px-3 py-1 rounded-full text-xs font-semibold border
          ${roleColor}
        `}>
          {roleDisplayName}
        </div>

        {/* User Avatar with Initials */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
          style={{ backgroundColor: "#10b981", color: "white" }}
        >
          {getInitials(user.fullName)}
        </div>
      </div>
    </div>
  );
}
