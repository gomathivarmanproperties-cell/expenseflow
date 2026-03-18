"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  doc, getDoc, onSnapshot, updateDoc, serverTimestamp,
  collection, addDoc, query, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FileText, Receipt, Wallet, Eye, CheckCircle, XCircle,
  IndianRupee, Calendar, User, ArrowLeft, AlertCircle,
  MessageSquare, Save
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

interface ExpenseReview {
  [expenseId: string]: {
    status: "approved" | "rejected";
    comment: string;
  };
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpenseReportReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reviews, setReviews] = useState<ExpenseReview>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        const reportData = { id: doc.id, ...doc.data() } as ExpenseReport;
        setReport(reportData);

        // Check if user can review this report
        if (!user) return;
        
        const canReview = (user.role === "admin") ||
          (user.role === "manager" && reportData.status === "pending_manager" && reportData.assignedApproverId === user.uid) ||
          (user.role === "finance" && reportData.status === "pending_finance");

        if (!canReview) {
          showToast("You don't have permission to review this report", "error");
          router.push("/expense-reports");
        }
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

      // Initialize reviews based on current expense status
      const initialReviews: ExpenseReview = {};
      data.forEach(exp => {
        initialReviews[exp.id] = {
          status: exp.status === "approved" ? "approved" : exp.status === "rejected" ? "rejected" : "approved",
          comment: exp.managerComment || ""
        };
      });
      setReviews(initialReviews);
    });

    return () => {
      unsubscribeReport();
      unsubscribeExpenses();
    };
  }, [reportId, user, router]);

  const handleReviewChange = (expenseId: string, field: "status" | "comment", value: string) => {
    setReviews(prev => ({
      ...prev,
      [expenseId]: {
        ...prev[expenseId],
        [field]: field === "status" ? value as "approved" | "rejected" : value
      }
    }));
  };

  const handleSubmitReview = async () => {
    if (!report || !user) return;

    setSubmitting(true);
    try {
      // Calculate totals
      const approvedExpenses = expenses.filter(exp => reviews[exp.id]?.status === "approved");
      const rejectedExpenses = expenses.filter(exp => reviews[exp.id]?.status === "rejected");
      
      const approvedTotal = approvedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const rejectedTotal = rejectedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

      // Update all expenses with review status
      const expenseUpdates = expenses.map(exp => {
        const review = reviews[exp.id];
        return updateDoc(doc(db, "expenses", exp.id), {
          status: review.status,
          managerComment: review.comment || "",
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(expenseUpdates);

      // Determine new report status
      let newReportStatus: string;
      if (approvedExpenses.length === 0) {
        // All rejected
        newReportStatus = "rejected";
      } else if (rejectedExpenses.length === 0) {
        // All approved
        newReportStatus = user.role === "finance" ? "paid" : "pending_finance";
      } else {
        // Partially approved
        newReportStatus = user.role === "finance" ? "paid" : "pending_finance";
      }

      // Update report
      await updateDoc(doc(db, "expenseReports", reportId), {
        status: newReportStatus,
        totalAmount: approvedTotal,
        approvalHistory: [
          ...(report.approvalHistory || []),
          {
            action: user.role === "finance" ? "approved" : "reviewed",
            by: user.uid,
            byName: user.fullName,
            at: new Date().toISOString(),
            note: `Approved ${approvedExpenses.length} expenses (${formatINR(approvedTotal)}), Rejected ${rejectedExpenses.length} expenses (${formatINR(rejectedTotal)})`
          }
        ],
        updatedAt: serverTimestamp()
      });

      // Notify submitter
      await addDoc(collection(db, "notifications"), {
        userId: report.submittedBy,
        title: user.role === "finance" ? "Expense Report Paid" : "Expense Report Reviewed",
        message: user.role === "finance"
          ? `Your report "${report.title}" has been paid. Total amount: ${formatINR(approvedTotal)}`
          : `Your report "${report.title}" has been reviewed. ${approvedExpenses.length} expenses approved (${formatINR(approvedTotal)}), ${rejectedExpenses.length} rejected (${formatINR(rejectedTotal)})`,
        type: user.role === "finance" ? "success" : "info",
        read: false,
        createdAt: serverTimestamp()
      });

      showToast(`Review completed! ${approvedExpenses.length} approved, ${rejectedExpenses.length} rejected`, "success");
      router.push("/expense-reports");
    } catch (error) {
      console.error("Review submission error:", error);
      showToast("Failed to submit review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const approvedCount = Object.values(reviews).filter(r => r.status === "approved").length;
  const rejectedCount = Object.values(reviews).filter(r => r.status === "rejected").length;
  const approvedTotal = expenses
    .filter(exp => reviews[exp.id]?.status === "approved")
    .reduce((sum, exp) => sum + exp.amount, 0);

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
              Review Report: {report.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {report.expenseIds?.length || 0} expense{(report.expenseIds?.length || 0) !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                by {report.submittedByName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <CheckCircle size={16} color="#166534" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>Approved</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>
            {approvedCount}
          </div>
          <div style={{ fontSize: 13, color: "#15803d" }}>
            {formatINR(approvedTotal)}
          </div>
        </div>

        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <XCircle size={16} color="#991b1b" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#991b1b" }}>Rejected</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#991b1b" }}>
            {rejectedCount}
          </div>
          <div style={{ fontSize: 13, color: "#b91c1c" }}>
            {formatINR(expenses
              .filter(exp => reviews[exp.id]?.status === "rejected")
              .reduce((sum, exp) => sum + exp.amount, 0))}
          </div>
        </div>

        <div style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <FileText size={16} color="#374151" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Period</span>
          </div>
          <div style={{ fontSize: 14, color: "#0f172a" }}>
            {report.period === "15days" ? "15 Days" : 
             report.period === "monthly" ? "Monthly" : "Custom"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {safeDate(report.startDate)} - {safeDate(report.endDate)}
          </div>
        </div>
      </div>

      {/* Expenses Review */}
      <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: 0 }}>Review Expenses</h3>
        </div>
        
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Title</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Category</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Amount</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Date</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Receipt</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#374151" }}>Decision</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(expense => (
              <tr key={expense.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <div style={{ fontWeight: 500, color: "#0f172a", marginBottom: 4 }}>{expense.title}</div>
                  {expense.notes && (
                    <div style={{ fontSize: 12, color: "#64748b" }}>{expense.notes}</div>
                  )}
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>{expense.category}</td>
                <td style={{ padding: "16px", fontSize: 13, fontWeight: 600 }}>
                  {formatINR(expense.amount)}
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>{safeDate(expense.date)}</td>
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
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button
                      onClick={() => handleReviewChange(expense.id, "status", "approved")}
                      style={{
                        padding: "6px 12px", 
                        backgroundColor: reviews[expense.id]?.status === "approved" ? "#10b981" : "#f3f4f6",
                        color: reviews[expense.id]?.status === "approved" ? "white" : "#374151",
                        border: "none", borderRadius: 6,
                        fontSize: 12, fontWeight: 500, cursor: "pointer"
                      }}
                    >
                      <CheckCircle size={12} />
                    </button>
                    <button
                      onClick={() => handleReviewChange(expense.id, "status", "rejected")}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: reviews[expense.id]?.status === "rejected" ? "#ef4444" : "#f3f4f6",
                        color: reviews[expense.id]?.status === "rejected" ? "white" : "#374151",
                        border: "none", borderRadius: 6,
                        fontSize: 12, fontWeight: 500, cursor: "pointer"
                      }}
                    >
                      <XCircle size={12} />
                    </button>
                  </div>
                </td>
                <td style={{ padding: "16px", fontSize: 13 }}>
                  <input
                    type="text"
                    value={reviews[expense.id]?.comment || ""}
                    onChange={e => handleReviewChange(expense.id, "comment", e.target.value)}
                    placeholder="Add comment..."
                    style={{
                      padding: "6px 8px", border: "1px solid #e2e8f0",
                      borderRadius: 4, fontSize: 12, width: "100%",
                      backgroundColor: reviews[expense.id]?.status === "rejected" ? "#fef2f2" : "white"
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "12px 24px", backgroundColor: "#f1f5f9",
            color: "#374151", border: "1px solid #e2e8f0",
            borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer"
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmitReview}
          disabled={submitting}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 28px", backgroundColor: "#10b981",
            color: "white", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1
          }}
        >
          <Save size={16} />
          {submitting ? "Submitting..." : `Submit Review (${approvedCount} approved, ${rejectedCount} rejected)`}
        </button>
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
