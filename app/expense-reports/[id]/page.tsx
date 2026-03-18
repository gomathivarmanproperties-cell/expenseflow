"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  doc, getDoc, onSnapshot, updateDoc, serverTimestamp,
  collection, getDocs, query, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FileText, Receipt, Wallet, Eye, Download,
  CheckCircle, XCircle, IndianRupee, Calendar,
  User, ArrowLeft, AlertCircle, Edit
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

export default function ExpenseReportDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!reportId) return;

    // Load report
    const unsubscribeReport = onSnapshot(doc(db, "expenseReports", reportId), (doc) => {
      if (doc.exists()) {
        setReport({ id: doc.id, ...doc.data() } as ExpenseReport);
      } else {
        showToast("Report not found", "error");
        router.push("/expense-reports");
      }
    });

    // Load expenses for this report
    const expensesQuery = query(
      collection(db, "expenses"),
      where("reportId", "==", reportId),
      orderBy("date", "desc")
    );

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snap) => {
      const data = snap.docs.map(d => ({ 
        id: d.id, ...d.data() 
      } as Expense));
      setExpenses(data);
      setLoading(false);
    });

    return () => {
      unsubscribeReport();
      unsubscribeExpenses();
    };
  }, [reportId, router]);

  const canEdit = report && user && (
    report.status === "draft" || 
    (report.status === "rejected" && report.submittedBy === user.uid)
  );

  const canReview = report && user && (
    (user.role === "admin") ||
    (user.role === "manager" && report.status === "pending_manager" && report.assignedApproverId === user.uid) ||
    (user.role === "finance" && report.status === "pending_finance")
  );

  const handleDownloadPDF = async () => {
    if (!report) return;
    
    // Simple download implementation - in production you'd use a PDF library
    const reportData = {
      title: report.title,
      period: report.period,
      startDate: report.startDate,
      endDate: report.endDate,
      submittedBy: report.submittedByName,
      totalAmount: report.totalAmount,
      expenses: expenses.map(exp => ({
        title: exp.title,
        category: exp.category,
        amount: exp.amount,
        date: exp.date,
        status: exp.status,
        managerComment: exp.managerComment
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]/gi, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Report downloaded", "success");
  };

  if (loading || !report) {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: "8px", backgroundColor: "#f3f4f6",
              border: "none", borderRadius: 8, cursor: "pointer"
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>
              {report.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusBadge status={report.status} />
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {report.expenseIds?.length || 0} expense{(report.expenseIds?.length || 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleDownloadPDF}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 16px", backgroundColor: "#f3f4f6",
              color: "#374151", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: "pointer"
            }}
          >
            <Download size={16} />
            Download
          </button>
          {canEdit && (
            <button
              onClick={() => router.push(`/expense-reports/${reportId}/edit`)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", backgroundColor: "#f59e0b",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}
            >
              <Edit size={16} />
              Edit Report
            </button>
          )}
          {canReview && (
            <button
              onClick={() => router.push(`/expense-reports/${reportId}/review`)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", backgroundColor: "#10b981",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}
            >
              <CheckCircle size={16} />
              Review Report
            </button>
          )}
        </div>
      </div>

      {/* Report Info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Calendar size={16} color="#64748b" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Period</span>
          </div>
          <div style={{ fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
            {report.period === "15days" ? "15 Days" : 
             report.period === "monthly" ? "Monthly" : "Custom"}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {safeDate(report.startDate)} - {safeDate(report.endDate)}
          </div>
        </div>

        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <IndianRupee size={16} color="#64748b" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Total Amount</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            {formatINR(report.totalAmount)}
          </div>
        </div>

        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <User size={16} color="#64748b" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Submitted By</span>
          </div>
          <div style={{ fontSize: 14, color: "#0f172a" }}>{report.submittedByName}</div>
          {report.assignedApproverName && (
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              Approver: {report.assignedApproverName}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {report.notes && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 12px 0" }}>Notes</h3>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            {report.notes}
          </p>
        </div>
      )}

      {/* Expenses Table */}
      <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: 0 }}>Expense Items</h3>
        </div>
        
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Title</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Category</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Amount</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Date</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Receipt</th>
              {canReview && <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#374151" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map(expense => (
              <tr key={expense.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: "#0f172a", marginBottom: 4 }}>{expense.title}</div>
                    {expense.managerComment && (
                      <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                        💬 {expense.managerComment}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>{expense.category}</td>
                <td style={{ padding: "16px", fontSize: 13, fontWeight: 600 }}>
                  {formatINR(expense.amount)}
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>{safeDate(expense.date)}</td>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <StatusBadge status={expense.status} />
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  {expense.receiptURL ? (
                    <button
                      onClick={() => window.open(expense.receiptURL, "_blank")}
                      style={{
                        padding: "4px 8px", backgroundColor: "#f1f5f9",
                        border: "1px solid #e2e8f0", borderRadius: 4,
                        fontSize: 11, cursor: "pointer"
                      }}
                    >
                      <Eye size={12} color="#64748b" />
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                  )}
                </td>
                {canReview && (
                  <td style={{ padding: "16px", fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      {expense.status === "draft" && (
                        <>
                          <button
                            onClick={() => {/* Handle approve */}}
                            style={{
                              padding: "6px 12px", backgroundColor: "#10b981",
                              color: "white", border: "none", borderRadius: 6,
                              fontSize: 12, fontWeight: 500, cursor: "pointer"
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {/* Handle reject */}}
                            style={{
                              padding: "6px 12px", backgroundColor: "#ef4444",
                              color: "white", border: "none", borderRadius: 6,
                              fontSize: 12, fontWeight: 500, cursor: "pointer"
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {expenses.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Receipt size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
              No expenses found
            </h3>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
              This report doesn't contain any expense items
            </p>
          </div>
        )}
      </div>

      {/* Approval History */}
      {report.approvalHistory && report.approvalHistory.length > 0 && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 16px 0" }}>Approval History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {report.approvalHistory.map((step, index) => (
              <div key={index} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  backgroundColor: step.action === "approved" ? "#dcfce7" : "#fee2e2",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {step.action === "approved" ? 
                    <CheckCircle size={16} color="#166534" /> : 
                    <XCircle size={16} color="#991b1b" />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>
                    {step.action === "approved" ? "Approved by" : "Rejected by"} {step.byName}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {safeDate(step.at)}
                    {step.note && <span style={{ marginLeft: 8 }}>• {step.note}</span>}
                  </div>
                </div>
              </div>
            ))}
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
