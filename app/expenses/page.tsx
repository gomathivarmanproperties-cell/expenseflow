"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, addDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Plus, Search, Receipt, Wallet, Eye,
  CheckCircle, XCircle, IndianRupee, Clock,
  AlertCircle, Filter
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  assignedApproverId?: string;
  assignedApproverName?: string;
  status: "pending_manager" | "pending_finance" | "approved" | "rejected" | "paid";
  notes?: string;
  receiptURL?: string;
  createdAt?: string;
  approvalHistory?: ApprovalStep[];
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
  pending_manager: { label: "Pending Manager", bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  pending_finance: { label: "Pending Finance", bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
  approved:        { label: "Approved",         bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  rejected:        { label: "Rejected",          bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  paid:            { label: "Paid",              bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_manager;
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

export default function ExpensesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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

    // Use simple query without orderBy to avoid needing composite indexes
    let q;
  
    if (role === "employee") {
      q = query(
        collection(db, "expenses"),
        where("submittedBy", "==", user.uid)
      );
    } else if (role === "manager") {
      q = query(
        collection(db, "expenses"),
        where("assignedApproverId", "==", user.uid)
      );
    } else {
      // Finance and Admin see all
      q = query(collection(db, "expenses"));
    }

    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ 
        id: d.id, ...d.data() 
      } as Expense));
      
      // Sort client-side by createdAt descending
      data.sort((a, b) => {
        const getTime = (val: unknown): number => {
          if (!val) return 0;
          const v = val as { toDate?: () => Date };
          if (v.toDate) return v.toDate().getTime();
          return new Date(val as string).getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      
      setExpenses(data);
      setLoading(false);
    }, (error) => {
      console.error("Expenses listener error:", error);
      setLoading(false);
    });
  }, [user]);

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    { key: "all", label: "All" },
    { key: "mine", label: "My Submissions" },
    ...(isManagerOrAbove ? [{ key: "pending", label: "Pending Approval" }] : []),
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  const filtered = expenses.filter(e => {
    if (activeTab === "mine" && e.submittedBy !== user?.uid) return false;
    if (activeTab === "pending" && !["pending_manager", "pending_finance"].includes(e.status)) return false;
    if (activeTab === "approved" && e.status !== "approved") return false;
    if (activeTab === "rejected" && e.status !== "rejected") return false;
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!e.title?.toLowerCase().includes(s) && !e.submittedByName?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleApprove = async (expense: Expense) => {
    if (!user) return;
    setActionLoading(expense.id);
    try {
      // Manager approves → moves to pending_finance
      // Finance approves → moves to approved
      const newStatus = 
        expense.status === "pending_manager" 
          ? "pending_finance" 
          : "approved";

      await updateDoc(doc(db, "expenses", expense.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        approvalHistory: [
          ...(expense.approvalHistory ?? []),
          { 
            action: "approved", 
            by: user.uid, 
            byName: user.fullName,
            at: new Date().toISOString(),
            note: ""
          }
        ]
      });

      // Notify submitter
      await addDoc(collection(db, "notifications"), {
        userId: expense.submittedBy,
        title: newStatus === "pending_finance" 
          ? "Expense Approved by Manager" 
          : "Expense Approved",
        message: newStatus === "pending_finance"
          ? `Your ₹${expense.amount} expense for ${expense.category} was approved by manager. Pending finance review.` 
          : `Your ₹${expense.amount} expense for ${expense.category} has been fully approved.`,
        type: "approval",
        read: false,
        createdAt: serverTimestamp()
      });

      showToast(
        newStatus === "pending_finance" 
          ? "Approved! Sent to Finance." 
          : "Expense fully approved!", 
        "success"
      );
    } catch (error) {
      console.error("Approve error:", error);
      showToast("Failed to approve. Please try again.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const canApprove = (expense: Expense) => {
    // Manager can approve if they are assigned approver
    // and expense is pending manager review
    if (expense.status === "pending_manager" && 
        (expense.assignedApproverId === user?.uid || 
         role === "admin")) {
      return true;
    }
    // Finance can approve if expense is pending finance
    if (expense.status === "pending_finance" && 
        (role === "finance" || role === "admin")) {
      return true;
    }
    return false;
  };

  // Finance marks as paid after approval
  const canMarkPaid = (expense: Expense) =>
    expense.status === "approved" && 
    (role === "finance" || role === "admin");

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <div style={{ display: "grid", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 60, backgroundColor: "#f3f4f6", borderRadius: 12 }} />
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
            Expenses & Petty Cash
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => router.push("/expenses/new")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", backgroundColor: "#10b981",
            color: "white", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: "pointer"
          }}
        >
          <Plus size={16} />
          New Submission
        </button>
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
            <span style={{
              marginLeft: 6, padding: "1px 7px",
              backgroundColor: activeTab === tab.key ? "#d1fae5" : "#f1f5f9",
              color: activeTab === tab.key ? "#065f46" : "#94a3b8",
              borderRadius: 9999, fontSize: 11, fontWeight: 600
            }}>
              {expenses.filter(e => {
                if (tab.key === "all") return true;
                if (tab.key === "mine") return e.submittedBy === user?.uid;
                if (tab.key === "pending") return ["pending_manager", "pending_finance"].includes(e.status);
                if (tab.key === "approved") return e.status === "approved";
                if (tab.key === "rejected") return e.status === "rejected";
                return true;
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: 12, zIndex: 1 }} />
          <input
            type="text"
            placeholder="Search expenses..."
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
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: "10px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 8, fontSize: 14,
            backgroundColor: "white", cursor: "pointer"
          }}
        >
          <option value="all">All Types</option>
          <option value="reimbursement">Reimbursement</option>
          <option value="petty_cash_advance">Petty Cash</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Title</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Type</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Category</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Amount</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Project</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Submitted By</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Date</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#374151" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(expense => (
              <tr key={expense.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {expense.type === "reimbursement" ? 
                      <Receipt size={16} color="#64748b" /> : 
                      <Wallet size={16} color="#64748b" />
                    }
                    <div>
                      <div style={{ fontWeight: 500, color: "#0f172a", marginBottom: 2 }}>{expense.title}</div>
                      {expense.receiptURL && (
                        <button
                          onClick={() => window.open(expense.receiptURL, "_blank")}
                          style={{
                            padding: "4px 8px", backgroundColor: "#f1f5f9",
                            border: "1px solid #e2e8f0", borderRadius: 4,
                            fontSize: 11, cursor: "pointer", marginTop: 4
                          }}
                        >
                          <Eye size={12} color="#64748b" />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <span style={{
                    padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                    backgroundColor: expense.type === "reimbursement" ? "#dcfce7" : "#fef3c7",
                    color: expense.type === "reimbursement" ? "#166534" : "#92400e"
                  }}>
                    {expense.type === "reimbursement" ? "Reimbursement" : "Petty Cash"}
                  </span>
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>{expense.category}</td>
                <td style={{ padding: "16px", fontSize: 13, fontWeight: 600 }}>
                  {formatINR(expense.amount)}
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>{expense.projectName || "—"}</td>
                <td style={{ padding: "16px", fontSize: 13 }}>{expense.submittedByName}</td>
                <td style={{ padding: "16px", fontSize: 13 }}>{safeDate(expense.date)}</td>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <StatusBadge status={expense.status} />
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {canApprove(expense) && (
                      <button
                        onClick={() => handleApprove(expense)}
                        disabled={actionLoading === expense.id}
                        style={{
                          padding: "6px 12px", backgroundColor: "#10b981",
                          color: "white", border: "none", borderRadius: 6,
                          fontSize: 12, fontWeight: 500, cursor: "pointer",
                          opacity: actionLoading === expense.id ? 0.6 : 1
                        }}
                      >
                        {actionLoading === expense.id ? "..." : "Approve"}
                      </button>
                    )}
                    {canMarkPaid(expense) && (
                      <button
                        style={{
                          padding: "6px 12px", backgroundColor: "#8b5cf6",
                          color: "white", border: "none", borderRadius: 6,
                          fontSize: 12, fontWeight: 500, cursor: "pointer"
                        }}
                      >
                        Mark Paid
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
            <AlertCircle size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
              {search ? "No expenses found" : "No expenses yet"}
            </h3>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
              {search ? "Try adjusting your search terms" : "Submit your first expense to get started"}
            </p>
          </div>
        )}
      </div>

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
