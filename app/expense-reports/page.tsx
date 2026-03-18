"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, addDoc, getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Plus, Search, Receipt, Wallet, Eye, FileText,
  CheckCircle, XCircle, IndianRupee, Clock,
  AlertCircle, Calendar, Filter
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseReport {
  id: string;
  title: string;
  period: "15days" | "monthly" | "custom";
  startDate: string;
  endDate: string;
  submittedBy: string;
  submittedByName: string;
  assignedApproverId?: string;
  assignedApproverName?: string;
  status: "draft" | "pending_manager" | "pending_finance" | "paid" | "rejected";
  totalAmount: number;
  expenseIds: string[];
  approvalHistory: ApprovalStep[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Expense {
  id: string;
  title: string;
  type: "reimbursement" | "petty_cash_advance";
  category: string;
  amount: number;
  date: string;
  projectId?: string;
  projectName?: string;
  department?: string;
  submittedBy: string;
  submittedByName: string;
  reportId?: string;
  status: "draft" | "approved" | "rejected";
  managerComment?: string;
  notes?: string;
  receiptURL?: string;
  createdAt?: string;
}

interface ApprovalStep {
  action: string;
  by: string;
  byName: string;
  at: string;
  note?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(amount ?? 0);

const safeDate = (val: unknown) => {
  if (!val) return "—";
  try {
    const d = (val as { toDate?: () => Date }).toDate
      ? (val as { toDate: () => Date }).toDate()
      : new Date(val as string);
    return d.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
  } catch { return "—"; }
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  draft:           { label: "Draft",           bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  pending_manager: { label: "Pending Manager", bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  pending_finance: { label: "Pending Finance", bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
  approved:        { label: "Approved",         bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  rejected:        { label: "Rejected",          bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  paid:            { label: "Paid",              bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span style={{
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      padding: "3px 10px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap"
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpenseReportsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [draftExpenses, setDraftExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const role = user?.role ?? "employee";
  const isManagerOrAbove = role === "admin" || role === "manager" || role === "finance";

  useEffect(() => {
    if (!user) return;

    // Load expense reports
    let reportsQuery;
    if (role === "employee") {
      reportsQuery = query(
        collection(db, "expenseReports"),
        where("submittedBy", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    } else if (role === "manager") {
      reportsQuery = query(
        collection(db, "expenseReports"),
        where("assignedApproverId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    } else {
      // Finance and Admin see all
      reportsQuery = query(
        collection(db, "expenseReports"),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribeReports = onSnapshot(reportsQuery, (snap) => {
      const data = snap.docs.map(d => ({ 
        id: d.id, ...d.data() 
      } as ExpenseReport));
      setReports(data);
    });

    // Load draft expenses for employees
    if (role === "employee") {
      const draftsQuery = query(
        collection(db, "expenses"),
        where("submittedBy", "==", user.uid),
        where("status", "==", "draft"),
        orderBy("createdAt", "desc")
      );

      const unsubscribeDrafts = onSnapshot(draftsQuery, (snap) => {
        const data = snap.docs.map(d => ({ 
          id: d.id, ...d.data() 
        } as Expense));
        setDraftExpenses(data);
        setLoading(false);
      });

      return () => {
        unsubscribeReports();
        unsubscribeDrafts();
      };
    } else {
      setLoading(false);
      return unsubscribeReports;
    }
  }, [user, role]);

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = role === "employee" ? [
    { key: "all", label: "All Reports" },
    { key: "drafts", label: `Draft Expenses (${draftExpenses.length})` },
    { key: "pending", label: "Pending Approval" },
    { key: "approved", label: "Approved" },
    { key: "paid", label: "Paid" },
  ] : [
    { key: "all", label: "All Reports" },
    { key: "pending", label: "Pending Review" },
    { key: "approved", label: "Approved" },
    { key: "paid", label: "Paid" },
  ];

  const filtered = reports.filter(report => {
    if (activeTab === "drafts") return false; // Handled separately
    if (activeTab === "pending" && !["pending_manager", "pending_finance"].includes(report.status)) return false;
    if (activeTab === "approved" && report.status !== "approved") return false;
    if (activeTab === "paid" && report.status !== "paid") return false;
    if (periodFilter !== "all" && report.period !== periodFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!report.title?.toLowerCase().includes(s) && !report.submittedByName?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCreateReport = async (period: "15days" | "monthly" | "custom", startDate?: string, endDate?: string) => {
    if (!user) return;
    if (draftExpenses.length === 0) {
      showToast("No draft expenses to include in report", "error");
      return;
    }

    try {
      // Calculate date range
      const today = new Date();
      let start: Date, end: Date;
      
      if (period === "15days") {
        const day = today.getDate();
        if (day <= 15) {
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today.getFullYear(), today.getMonth(), 15);
        } else {
          start = new Date(today.getFullYear(), today.getMonth(), 16);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
      } else if (period === "monthly") {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      } else {
        // Custom
        if (!startDate || !endDate) return;
        start = new Date(startDate);
        end = new Date(endDate);
      }

      // Filter expenses within date range
      const expensesInRange = draftExpenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= start && expDate <= end;
      });

      if (expensesInRange.length === 0) {
        showToast("No draft expenses found in selected period", "error");
        return;
      }

      // Create report
      const reportData = {
        title: `${period === "15days" ? "15 Days" : period === "monthly" ? "Monthly" : "Custom"} Report - ${user.fullName}`,
        period,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        submittedBy: user.uid,
        submittedByName: user.fullName,
        assignedApproverId: user.assignedApproverId,
        assignedApproverName: user.assignedApproverName,
        status: "pending_manager",
        totalAmount: expensesInRange.reduce((sum, exp) => sum + exp.amount, 0),
        expenseIds: expensesInRange.map(exp => exp.id),
        approvalHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const reportRef = await addDoc(collection(db, "expenseReports"), reportData);

      // Update all expenses to link to report and change status
      const batch = expensesInRange.map(exp => 
        updateDoc(doc(db, "expenses", exp.id), {
          reportId: reportRef.id,
          status: "pending_manager",
          updatedAt: serverTimestamp()
        })
      );

      await Promise.all(batch);

      // Notify approver
      if (user.assignedApproverId) {
        await addDoc(collection(db, "notifications"), {
          userId: user.assignedApproverId,
          title: "New Expense Report",
          message: `${user.fullName} submitted a report with ${expensesInRange.length} expenses totaling ${formatINR(reportData.totalAmount)}`,
          type: "info",
          read: false,
          createdAt: serverTimestamp()
        });
      }

      showToast(`Report created with ${expensesInRange.length} expenses`, "success");
      router.push(`/expense-reports/${reportRef.id}`);
    } catch (error) {
      console.error("Create report error:", error);
      showToast("Failed to create report", "error");
    }
  };

  const canReview = (report: ExpenseReport) => {
    if (role === "admin") return true;
    if (role === "manager" && report.status === "pending_manager" && report.assignedApproverId === user?.uid) return true;
    if (role === "finance" && report.status === "pending_finance") return true;
    return false;
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <div style={{ display: "grid", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, backgroundColor: "#f3f4f6", borderRadius: 12 }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>
            Expense Reports
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            {filtered.length} report{filtered.length !== 1 ? "s" : ""} • {draftExpenses.length} draft expense{draftExpenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {role === "employee" && (
            <button
              onClick={() => router.push("/expenses/new")}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 18px", backgroundColor: "#64748b",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}
            >
              <Plus size={16} />
              Add Expense
            </button>
          )}
          {draftExpenses.length > 0 && role === "employee" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleCreateReport("15days")}
                style={{
                  padding: "10px 16px", backgroundColor: "#10b981",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Create 15 Days Report
              </button>
              <button
                onClick={() => handleCreateReport("monthly")}
                style={{
                  padding: "10px 16px", backgroundColor: "#3b82f6",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Create Monthly Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #e2e8f0", paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px", border: "none", cursor: "pointer",
              backgroundColor: "transparent", fontSize: 13, fontWeight: 500,
              color: activeTab === tab.key ? "#10b981" : "#64748b",
              borderBottom: activeTab === tab.key ? "2px solid #10b981" : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Draft Expenses Tab */}
      {activeTab === "drafts" && role === "employee" && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {draftExpenses.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <Receipt size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
                No Draft Expenses
              </h3>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px 0" }}>
                Submit expenses as drafts to include them in reports
              </p>
              <button
                onClick={() => router.push("/expenses/new")}
                style={{
                  padding: "10px 18px", backgroundColor: "#10b981",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Add First Expense
              </button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Title</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Category</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Amount</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#374151" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {draftExpenses.map(expense => (
                  <tr key={expense.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <div style={{ fontWeight: 500, color: "#0f172a" }}>{expense.title}</div>
                    </td>
                    <td style={{ padding: "16px", fontSize: 13 }}>{expense.category}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 600 }}>
                      {formatINR(expense.amount)}
                    </td>
                    <td style={{ padding: "16px", fontSize: 13 }}>{safeDate(expense.date)}</td>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          onClick={() => router.push(`/expenses/${expense.id}/edit`)}
                          style={{
                            padding: "6px 12px", backgroundColor: "#f59e0b",
                            color: "white", border: "none", borderRadius: 6,
                            fontSize: 12, fontWeight: 500, cursor: "pointer"
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Reports List */}
      {activeTab !== "drafts" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
              <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: 12, zIndex: 1 }} />
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: "10px 12px 10px 40px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8, fontSize: 14,
                  width: "100%", outline: "none"
                }}
              />
            </div>
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8, fontSize: 14,
                backgroundColor: "white", cursor: "pointer"
              }}
            >
              <option value="all">All Periods</option>
              <option value="15days">15 Days</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Reports Table */}
          <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Report Title</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Period</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Total Amount</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Submitted By</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Date Range</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#374151" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(report => (
                  <tr key={report.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={16} color="#64748b" />
                        <div>
                          <div style={{ fontWeight: 500, color: "#0f172a", marginBottom: 2 }}>{report.title}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {report.expenseIds?.length || 0} expense{(report.expenseIds?.length || 0) !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <span style={{
                        padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        backgroundColor: report.period === "15days" ? "#fef3c7" : 
                                       report.period === "monthly" ? "#dbeafe" : "#f3f4f6",
                        color: report.period === "15days" ? "#92400e" : 
                               report.period === "monthly" ? "#1e40af" : "#374151"
                      }}>
                        {report.period === "15days" ? "15 Days" : 
                         report.period === "monthly" ? "Monthly" : "Custom"}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 600 }}>
                      {formatINR(report.totalAmount)}
                    </td>
                    <td style={{ padding: "16px", fontSize: 13 }}>{report.submittedByName}</td>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <div style={{ fontSize: 12 }}>
                        <div>{safeDate(report.startDate)}</div>
                        <div style={{ color: "#64748b" }}>to {safeDate(report.endDate)}</div>
                      </div>
                    </td>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <StatusBadge status={report.status} />
                    </td>
                    <td style={{ padding: "16px", fontSize: 13 }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          onClick={() => router.push(`/expense-reports/${report.id}`)}
                          style={{
                            padding: "6px 12px", backgroundColor: "#3b82f6",
                            color: "white", border: "none", borderRadius: 6,
                            fontSize: 12, fontWeight: 500, cursor: "pointer"
                          }}
                        >
                          <Eye size={12} />
                        </button>
                        {canReview(report) && (
                          <button
                            onClick={() => router.push(`/expense-reports/${report.id}/review`)}
                            style={{
                              padding: "6px 12px", backgroundColor: "#10b981",
                              color: "white", border: "none", borderRadius: 6,
                              fontSize: 12, fontWeight: 500, cursor: "pointer"
                            }}
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <FileText size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
                  {search ? "No reports found" : "No expense reports yet"}
                </h3>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
                  {search ? "Try adjusting your search terms" : "Create your first expense report to get started"}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          backgroundColor: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          borderRadius: 10, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 14, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </main>
  );
}
