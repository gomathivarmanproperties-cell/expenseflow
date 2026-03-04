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

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const userRole = user?.role || "employee";
  const allowedPages = roleAccess[userRole as keyof typeof roleAccess] || [];

  const filteredNavItems = navigationItems.filter(item => {
    const pageName = item.href.replace("/", "");
    return allowedPages.includes(pageName);
  });

  return (
    <div 
      className="fixed left-0 top-0 h-full w-[240px] z-40"
      style={{ backgroundColor: "#064e3b" }}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div 
          className="flex items-center p-6"
          style={{ borderBottom: "1px solid #065f46" }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#10b981" }}
            >
              <span className="text-white font-bold text-sm">EF</span>
            </div>
            <span 
              className="font-semibold text-lg"
              style={{ color: "#d1fae5" }}
            >
              ExpenseFlow
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-3 rounded-md transition-colors duration-200"
                  style={{
                    padding: "10px 16px",
                    marginBottom: "8px",
                    backgroundColor: isActive ? "#10b981" : "transparent",
                    color: isActive ? "white" : "#d1fae5"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "#065f46";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#d1fae5";
                    }
                  }}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
