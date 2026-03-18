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

    let q;
    if (role === "employee") {
      q = query(
        collection(db, "expenses"),
        where("submittedBy", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    } else if (role === "manager") {
      q = query(
        collection(db, "expenses"),
        where("assignedApproverId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    }

    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
      setLoading(false);
    }, () => setLoading(false));
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
      const isManager = role === "manager" || (role === "admin" && expense.status === "pending_manager");
      const newStatus = isManager ? "pending_finance" : "paid";

      await updateDoc(doc(db, "expenses", expense.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        approvalHistory: [
          ...(expense.approvalHistory ?? []),
          { action: "approved", by: user.uid, byName: user.fullName, at: new Date().toISOString() }
        ]
      });

      // Notify next in chain
      if (isManager) {
        // Notify all finance users
        await addDoc(collection(db, "notifications"), {
          userId: expense.submittedBy,
          title: "Expense Approved by Manager",
          message: `₹${expense.amount} for ${expense.category} approved. Pending finance.`,
          type: "approval", read: false, createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "notifications"), {
          userId: expense.submittedBy,
          title: "Expense Paid",
          message: `Your expense of ₹${expense.amount} for ${expense.category} has been paid.`,
          type: "approval", read: false, createdAt: serverTimestamp()
        });
      }
      showToast("Expense approved successfully!", "success");
    } catch {
      showToast("Failed to approve expense.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      const expense = expenses.find(e => e.id === rejectModal.id);
      await updateDoc(doc(db, "expenses", rejectModal.id), {
        status: "rejected",
        updatedAt: serverTimestamp(),
        approvalHistory: [
          ...(expense?.approvalHistory ?? []),
          { action: "rejected", by: user.uid, byName: user.fullName,
            at: new Date().toISOString(), note: rejectReason }
        ]
      });
      await addDoc(collection(db, "notifications"), {
        userId: expense?.submittedBy,
        title: "Expense Rejected",
        message: `Your expense for ${expense?.category} was rejected. Reason: ${rejectReason}`,
        type: "rejection", read: false, createdAt: serverTimestamp()
      });
      setRejectModal(null);
      setRejectReason("");
      showToast("Expense rejected.", "success");
    } catch {
      showToast("Failed to reject expense.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (expense: Expense) => {
    if (!user) return;
    setActionLoading(expense.id);
    try {
      await updateDoc(doc(db, "expenses", expense.id), {
        status: "paid",
        updatedAt: serverTimestamp(),
        approvalHistory: [
          ...(expense.approvalHistory ?? []),
          { action: "paid", by: user.uid, byName: user.fullName, at: new Date().toISOString() }
        ]
      });
      await addDoc(collection(db, "notifications"), {
        userId: expense.submittedBy,
        title: "Expense Paid",
        message: `Your expense of ₹${expense.amount} has been paid.`,
        type: "approval", read: false, createdAt: serverTimestamp()
      });
      showToast("Marked as paid!", "success");
    } catch {
      showToast("Failed to mark as paid.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const canApprove = (expense: Expense) => {
    if (expense.status === "pending_manager" &&
      (expense.assignedApproverId === user?.uid || role === "admin")) return true;
    if (expense.status === "pending_finance" && (role === "finance" || role === "admin")) return true;
    return false;
  };

  const canMarkPaid = (expense: Expense) =>
    expense.status === "approved" && (role === "finance" || role === "admin");

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
          <Search size={15} style={{ position: "absolute", left: 12, top: 11, color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search by title or person..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 36px",
              border: "1px solid #e2e8f0", borderRadius: 8,
              fontSize: 13, outline: "none", boxSizing: "border-box"
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
            onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: "10px 12px", border: "1px solid #e2e8f0",
            borderRadius: 8, fontSize: 13, backgroundColor: "white",
            outline: "none", cursor: "pointer"
          }}
        >
          <option value="all">All Types</option>
          <option value="reimbursement">Expense Reimbursement</option>
          <option value="petty_cash_advance">Petty Cash Advance</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60,
          backgroundColor: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 16
        }}>
          <Receipt size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 8px 0" }}>
            No expenses found
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px 0" }}>
            {role === "employee"
              ? "Submit your first expense to get started."
              : "No expenses match your current filters."}
          </p>
          {role !== "finance" && (
            <button
              onClick={() => router.push("/expenses/new")}
              style={{
                padding: "10px 20px", backgroundColor: "#10b981",
                color: "white", border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}
            >
              New Submission
            </button>
          )}
        </div>
      ) : (
        <div style={{
          backgroundColor: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 16, overflow: "hidden"
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {["Title", "Type", "Category", "Amount", "Project", "Submitted By", "Date", "Status", "Actions"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 600, color: "#64748b",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      whiteSpace: "nowrap"
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense, i) => (
                  <tr
                    key={expense.id}
                    style={{
                      borderTop: "1px solid #f1f5f9",
                      backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa",
                      transition: "background 0.1s"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#fff" : "#fafafa")}
                  >
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 500, color: "#0f172a", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {expense.title ?? "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#64748b" }}>
                        {expense.type === "petty_cash_advance"
                          ? <><Wallet size={12} /> Petty Cash</>
                          : <><Receipt size={12} /> Expense</>
                        }
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                      {expense.category ?? "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                      {formatINR(expense.amount)}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#64748b" }}>
                      {expense.projectName ?? "General"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                      {expense.submittedByName ?? "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                      {safeDate(expense.date)}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge status={expense.status} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {/* View */}
                        <button
                          onClick={() => router.push(`/expenses/${expense.id}`)}
                          style={{ padding: 6, backgroundColor: "#f1f5f9", border: "none", borderRadius: 6, cursor: "pointer" }}
                          title="View"
                        >
                          <Eye size={14} color="#64748b" />
                        </button>

                        {/* Approve */}
                        {canApprove(expense) && (
                          <button
                            onClick={() => handleApprove(expense)}
                            disabled={actionLoading === expense.id}
                            style={{ padding: 6, backgroundColor: "#dcfce7", border: "none", borderRadius: 6, cursor: "pointer" }}
                            title="Approve"
                          >
                            <CheckCircle size={14} color="#16a34a" />
                          </button>
                        )}

                        {/* Reject */}
                        {canApprove(expense) && (
                          <button
                            onClick={() => setRejectModal({ id: expense.id, name: expense.title })}
                            style={{ padding: 6, backgroundColor: "#fee2e2", border: "none", borderRadius: 6, cursor: "pointer" }}
                            title="Reject"
                          >
                            <XCircle size={14} color="#dc2626" />
                          </button>
                        )}

                        {/* Mark Paid */}
                        {canMarkPaid(expense) && (
                          <button
                            onClick={() => handleMarkPaid(expense)}
                            disabled={actionLoading === expense.id}
                            style={{ padding: "6px 10px", backgroundColor: "#ede9fe", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#5b21b6" }}
                            title="Mark as Paid"
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
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 14, padding: 24, width: 420, maxWidth: "90%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 8px 0" }}>
              Reject Expense
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px 0" }}>
              &ldquo;{rejectModal.name}&rdquo;
            </p>
            <textarea
              placeholder="Reason for rejection (required)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: 10, border: "1px solid #e2e8f0",
                borderRadius: 8, fontSize: 13, resize: "vertical",
                outline: "none", boxSizing: "border-box", marginBottom: 16
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                style={{ padding: "8px 16px", backgroundColor: "#f1f5f9", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === rejectModal.id}
                style={{ padding: "8px 16px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
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