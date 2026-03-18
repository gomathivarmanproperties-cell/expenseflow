"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  IndianRupee,
  TrendingUp,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Building2,
  Receipt,
  Wallet,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
  budget: number;
  spent: number;
}

interface Expense {
  id: string;
  employeeName: string;
  submittedBy?: string;
  category: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "rejected";
  description: string;
  department?: string;
}

interface SummaryData {
  totalBudget: number;
  totalSpent: number;
  pendingExpenses: number;
  pendingInvoices: number;
  approvedThisMonth: number;
  myPendingCount: number;
  teamPendingCount: number;
  vendorPaymentsPending: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeDate = (val: any) => {
  if (!val) return "—";
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-IN", { 
      day: "numeric", month: "short", year: "numeric" 
    });
  } catch { return "—"; }
};

const safeAmount = (val: any) => {
  if (val === null || val === undefined) return "₹0";
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", { 
    style: "currency", currency: "INR", maximumFractionDigits: 0 
  }).format(num);
};

const safeStr = (val: any) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "—";
};

const formatDate = (date: any) => {
  if (!date) return "—";
  try {
    if (date?.toDate) return date.toDate()
      .toLocaleDateString("en-IN", { 
        day: "numeric", month: "short", year: "numeric" 
      });
    return new Date(date).toLocaleDateString("en-IN", { 
      day: "numeric", month: "short", year: "numeric" 
    });
  } catch { return "—"; }
};

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const getProgressColor = (pct: number) => {
  if (pct < 75) return "#10b981";
  if (pct <= 100) return "#f59e0b";
  return "#ef4444";
};

const statusStyle: Record<string, React.CSSProperties> = {
  pending: { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" },
  approved: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  rejected: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  paid: { backgroundColor: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" },
  overdue: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        ...statusStyle[status] ?? statusStyle.pending,
        padding: "3px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
  sub?: string;
}

function SummaryCard({ title, value, icon, accent = "#10b981", sub }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        transition: "box-shadow 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}
    >
      <div>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280", margin: "0 0 6px 0" }}>{title}</p>
        <p style={{ fontSize: "26px", fontWeight: 700, color: "#111827", margin: 0 }}>{value}</p>
        {sub && <p style={{ fontSize: "12px", color: "#9ca3af", margin: "4px 0 0 0" }}>{sub}</p>}
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "10px",
          backgroundColor: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData>({
    totalBudget: 0,
    totalSpent: 0,
    pendingExpenses: 0,
    pendingInvoices: 0,
    approvedThisMonth: 0,
    myPendingCount: 0,
    teamPendingCount: 0,
    vendorPaymentsPending: 0,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);

  const role = user?.role ?? "employee";
  const isAdminOrFinance = role === "admin" || role === "finance";
  const isManagerOrAbove = role === "admin" || role === "finance" || role === "manager";

  useEffect(() => {
    if (!user) return;

    const unsubs: (() => void)[] = [];

    // Departments — managers and above
    if (isManagerOrAbove) {
      unsubs.push(
        onSnapshot(collection(db, "departments"), (snap) => {
          const depts: Department[] = [];
          let totalBudget = 0;
          snap.forEach((doc) => {
            const d = doc.data();
            depts.push({ id: doc.id, name: d.name ?? "Unknown", budget: d.budget ?? 0, spent: d.spent ?? 0 });
            totalBudget += d.budget ?? 0;
          });
          setDepartments(depts);
          setSummary((prev) => ({ ...prev, totalBudget }));
        })
      );
    }

    // Expenses query — scoped by role
    const expenseQuery =
      isAdminOrFinance
        ? query(collection(db, "expenses"), orderBy("date", "desc"), limit(10))
        : role === "manager"
        ? query(collection(db, "expenses"), orderBy("date", "desc"), limit(10))
        : query(collection(db, "expenses"), orderBy("date", "desc"), limit(20)); // Fetch more for employee filtering

    unsubs.push(
      onSnapshot(expenseQuery, (snap) => {
        const expenses: Expense[] = [];
        let totalSpent = 0;
        let pendingCount = 0;
        let approvedThisMonth = 0;
        const now = new Date();

        snap.forEach((doc) => {
          const d = doc.data();
          
          // Client-side filtering for employees
          if (role === "employee") {
            const isEmployeeExpense = 
              d.submittedBy === user.uid || 
              d.userId === user.uid || 
              d.createdBy === user.uid || 
              d.employeeId === user.uid;
            
            if (!isEmployeeExpense) return; // Skip if not employee's expense
          }
          
          const expense: Expense = {
            id: doc.id,
            employeeName: d.submittedByName || d.employeeName || d.fullName || "Unknown",
            submittedBy: d.submittedBy,
            category: d.category ?? "Other",
            amount: d.amount ?? 0,
            date: d.date ?? "",
            status: d.status ?? "pending",
            description: d.description ?? "",
          };
          expenses.push(expense);
          if (expense.status === "approved") {
            totalSpent += expense.amount;
            const expDate = new Date(expense.date);
            if (
              expDate.getMonth() === now.getMonth() &&
              expDate.getFullYear() === now.getFullYear()
            ) {
              approvedThisMonth += expense.amount;
            }
          }
          if (expense.status === "pending") pendingCount++;
        });

        setRecentExpenses(expenses);
        setSummary((prev) => ({
          ...prev,
          totalSpent,
          pendingExpenses: pendingCount,
          myPendingCount: pendingCount,
          approvedThisMonth,
        }));
        setLoading(false);
      })
    );

    // Vendor payments — managers and above
    if (isManagerOrAbove) {
      unsubs.push(
        onSnapshot(
          query(collection(db, "invoices"), where("status", "==", "pending")),
          (snap) =>
            setSummary((prev) => ({
              ...prev,
              pendingInvoices: snap.size,
              vendorPaymentsPending: snap.size,
            }))
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [user]);

  // ── Greeting ────────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  // ── Role-specific summary cards ─────────────────────────────────────────────
  const renderCards = () => {
    if (role === "employee") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <SummaryCard
            title="My Pending Submissions"
            value={summary.myPendingCount}
            icon={<Clock size={22} color="#fff" />}
            accent="#f59e0b"
          />
          <SummaryCard
            title="Approved This Month"
            value={formatINR(summary.approvedThisMonth)}
            icon={<CheckCircle size={22} color="#fff" />}
            accent="#10b981"
          />
          <SummaryCard
            title="Total Submitted"
            value={recentExpenses.length}
            icon={<Receipt size={22} color="#fff" />}
            accent="#6366f1"
          />
        </div>
      );
    }

    if (role === "manager") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <SummaryCard
            title="Pending Approvals"
            value={summary.pendingExpenses}
            icon={<Clock size={22} color="#fff" />}
            accent="#f59e0b"
            sub="Awaiting your action"
          />
          <SummaryCard
            title="Team Spend This Month"
            value={formatINR(summary.approvedThisMonth)}
            icon={<TrendingUp size={22} color="#fff" />}
            accent="#10b981"
          />
          <SummaryCard
            title="Vendor Payments Pending"
            value={summary.vendorPaymentsPending}
            icon={<FileText size={22} color="#fff" />}
            accent="#8b5cf6"
          />
          <SummaryCard
            title="Total Budget"
            value={formatINR(summary.totalBudget)}
            icon={<Wallet size={22} color="#fff" />}
            accent="#0ea5e9"
          />
        </div>
      );
    }

    // Admin & Finance
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <SummaryCard
          title="Total Budget"
          value={formatINR(summary.totalBudget)}
          icon={<IndianRupee size={22} color="#fff" />}
          accent="#10b981"
        />
        <SummaryCard
          title="Total Spent"
          value={formatINR(summary.totalSpent)}
          icon={<TrendingUp size={22} color="#fff" />}
          accent="#0ea5e9"
        />
        <SummaryCard
          title="Pending Expenses"
          value={summary.pendingExpenses}
          icon={<Clock size={22} color="#fff" />}
          accent="#f59e0b"
        />
        <SummaryCard
          title="Vendor Payments Pending"
          value={summary.vendorPaymentsPending}
          icon={<FileText size={22} color="#fff" />}
          accent="#8b5cf6"
        />
      </div>
    );
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#fff",
                borderRadius: 14,
                padding: 20,
                border: "1px solid #e5e7eb",
                height: 100,
              }}
            >
              <div style={{ height: 12, backgroundColor: "#f3f4f6", borderRadius: 4, width: "50%", marginBottom: 12 }} />
              <div style={{ height: 28, backgroundColor: "#f3f4f6", borderRadius: 4, width: "70%" }} />
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Greeting */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>
            {greeting}, {firstName} 👋
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Here&apos;s what&apos;s happening with your expenses today.
          </p>
        </div>

        {/* Summary Cards */}
        {renderCards()}

        {/* Department Budget — Manager, Finance, Admin */}
        {isManagerOrAbove && departments.length > 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Building2 size={18} color="#10b981" />
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>
                Department Budget Overview
              </h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {departments.map((dept) => {
                const pct = dept.budget > 0 ? (dept.spent / dept.budget) * 100 : 0;
                return (
                  <div key={dept.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            backgroundColor: "#ecfdf5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#10b981",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {dept.name.charAt(0)}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0 }}>
                            {dept.name}
                          </p>
                          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                            {formatINR(dept.spent)} of {formatINR(dept.budget)}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          {pct.toFixed(1)}%
                        </span>
                        {dept.spent > dept.budget && (
                          <span
                            style={{
                              ...statusStyle.rejected,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Over Budget
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        backgroundColor: "#f3f4f6",
                        borderRadius: 999,
                        height: 7,
                      }}
                    >
                      <div
                        style={{
                          height: 7,
                          borderRadius: 999,
                          backgroundColor: getProgressColor(pct),
                          width: `${Math.min(pct, 100)}%`,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Activity Table */}
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={18} color="#10b981" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>
              {role === "employee" ? "My Recent Submissions" : "Recent Activity"}
            </h2>
          </div>
          {recentExpenses.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No expenses found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    {["Employee", "Category", "Amount", "Date", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((exp, i) => (
                    <tr
                      key={exp.id}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#fff" : "#fafafa")
                      }
                    >
                      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "#111827", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div>{safeStr(exp.employeeName)}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{safeStr(exp.department)}</div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 14, color: "#374151", verticalAlign: "top", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {safeStr(exp.category)}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "#111827", verticalAlign: "top" }}>
                        {safeAmount(exp.amount)}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 14, color: "#374151", verticalAlign: "top" }}>
                        {safeDate(exp.date)}
                      </td>
                      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                        <StatusBadge status={exp.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentExpenses.length === 0 && (
                <div style={{
                  textAlign: "center", padding: "40px 20px", color: "#6b7280",
                  fontSize: "14px"
                }}>
                  <div style={{ marginBottom: "8px" }}>📋</div>
                  <div>
                    {role === "employee" 
                      ? "No expenses submitted yet." 
                      : "No recent expenses found"
                    }
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    {role === "employee" 
                      ? "Click 'New Expense' to get started." 
                      : "Submitted expenses will appear here"
                    }
                  </div>
                  {role === "employee" && (
                    <button
                      onClick={() => window.location.href = "/expenses"}
                      style={{
                        marginTop: "16px",
                        padding: "8px 16px",
                        backgroundColor: "#10b981",
                        color: "#fff",
                        borderRadius: 8,
                        border: "none",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      New Expense
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
