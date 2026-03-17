"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { doc, onSnapshot, collection, query, orderBy, onSnapshot as onSnapshotCollection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar,
  Building,
  Users,
  DollarSign,
  TrendingUp,
  Briefcase,
  Receipt,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  code: string;
  clientName?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "on-hold" | "closed";
  totalBudget: number;
  budgetLines: {
    expenses: number;
    vendors: number;
    pettyCash: number;
    purchaseOrders: number;
  };
  spent: {
    expenses: number;
    vendors: number;
    pettyCash: number;
    po: number;
  };
  teamMembers: Array<{
    userId: string;
    fullName: string;
    role: string;
    department: string;
  }>;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: "expense" | "vendor";
  title: string;
  amount: number;
  date: string;
  status: string;
  referenceId: string;
}

export default function ProjectDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  // Redirect non-authorized users
  useEffect(() => {
    if (user && !["admin", "manager", "finance"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      "on-hold": { backgroundColor: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" },
      closed: { backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }
    };
    return {
      ...styles[status as keyof typeof styles],
      padding: "4px 12px",
      borderRadius: 9999,
      fontSize: 13,
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    };
  };

  const calculateProgress = (spent: number, budget: number) => {
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getProgressBarColor = (progress: number) => {
    if (progress >= 90) return "#dc2626";
    if (progress >= 70) return "#d97706";
    return "#10b981";
  };

  // Load project details
  useEffect(() => {
    if (!user || !projectId || !["admin", "manager", "finance"].includes(user.role)) return;

    const unsubscribe = onSnapshot(doc(db, "projects", projectId), (doc) => {
      if (doc.exists()) {
        setProject({ id: doc.id, ...doc.data() } as Project);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [user, projectId]);

  // Load transactions
  useEffect(() => {
    if (!user || !projectId || !["admin", "manager", "finance"].includes(user.role)) return;

    const expensesQuery = query(
      collection(db, "expenses"),
      orderBy("date", "desc")
    );
    
    const vendorsQuery = query(
      collection(db, "invoices"),
      orderBy("dueDate", "desc")
    );

    const unsubscribeExpenses = onSnapshotCollection(expensesQuery, (snapshot) => {
      const expensesData: Transaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.projectId === projectId) {
          expensesData.push({
            id: doc.id,
            type: "expense",
            title: data.description || data.category || "Expense",
            amount: data.amount || 0,
            date: data.date || "",
            status: data.status || "pending",
            referenceId: doc.id
          });
        }
      });
      
      // Combine with existing transactions
      setTransactions(prev => {
        const nonExpenses = prev.filter(t => t.type !== "expense");
        return [...nonExpenses, ...expensesData].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      });
    });

    const unsubscribeVendors = onSnapshotCollection(vendorsQuery, (snapshot) => {
      const vendorsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.projectId === projectId) {
          vendorsData.push({
            id: doc.id,
            type: "vendor",
            title: data.invoiceNumber || `Invoice to ${data.vendorName}`,
            amount: data.amount || 0,
            date: data.dueDate || "",
            status: data.status || "pending",
            referenceId: doc.id
          });
        }
      });
      
      // Combine with existing transactions
      setTransactions(prev => {
        const nonVendors = prev.filter(t => t.type !== "vendor");
        return [...nonVendors, ...vendorsData].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      });
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeVendors();
    };
  }, [user, projectId]);

  if (!user || !["admin", "manager", "finance"].includes(user.role)) {
    return null;
  }

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 16, color: "#6b7280" }}>Loading project details...</div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Project not found</h2>
          <button
            onClick={() => router.push("/projects")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Back to Projects
          </button>
        </div>
      </main>
    );
  }

  const totalSpent = project.spent.expenses + project.spent.vendors + 
                   project.spent.pettyCash + project.spent.po;
  const availableBalance = project.totalBudget - totalSpent;

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/projects")}
            style={{
              padding: "8px",
              backgroundColor: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            <ArrowLeft size={20} color="#374151" />
          </button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>
              {project.name}
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              {project.code} {project.clientName && `• ${project.clientName}`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={getStatusBadge(project.status)}>
            {project.status === "active" && <CheckCircle size={14} />}
            {project.status === "on-hold" && <Clock size={14} />}
            {project.status === "closed" && <AlertCircle size={14} />}
            {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace("-", " ")}
          </div>
          <button
            onClick={() => router.push(`/projects/${projectId}/edit`)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Edit size={16} />
            Edit Project
          </button>
        </div>
      </div>

      {/* Budget Overview */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Budget Overview</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <DollarSign size={16} color="#10b981" />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Total Budget</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>
              {formatINR(project.totalBudget)}
            </div>
            <div style={{
              width: "100%",
              height: 4,
              backgroundColor: "#f3f4f6",
              borderRadius: 2,
              marginTop: 8
            }} />
          </div>

          <div style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Briefcase size={16} color="#3b82f6" />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Expenses</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>
              {formatINR(project.spent.expenses)} / {formatINR(project.budgetLines.expenses)}
            </div>
            <div style={{
              width: "100%",
              height: 4,
              backgroundColor: "#f3f4f6",
              borderRadius: 2,
              marginTop: 8,
              overflow: "hidden"
            }}>
              <div
                style={{
                  width: `${calculateProgress(project.spent.expenses, project.budgetLines.expenses)}%`,
                  height: "100%",
                  backgroundColor: "#3b82f6"
                }}
              />
            </div>
          </div>

          <div style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Receipt size={16} color="#8b5cf6" />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Vendors</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>
              {formatINR(project.spent.vendors)} / {formatINR(project.budgetLines.vendors)}
            </div>
            <div style={{
              width: "100%",
              height: 4,
              backgroundColor: "#f3f4f6",
              borderRadius: 2,
              marginTop: 8,
              overflow: "hidden"
            }}>
              <div
                style={{
                  width: `${calculateProgress(project.spent.vendors, project.budgetLines.vendors)}%`,
                  height: "100%",
                  backgroundColor: "#8b5cf6"
                }}
              />
            </div>
          </div>

          <div style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <TrendingUp size={16} color="#10b981" />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Available Balance</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: availableBalance >= 0 ? "#111827" : "#dc2626" }}>
              {formatINR(availableBalance)}
            </div>
            <div style={{
              width: "100%",
              height: 4,
              backgroundColor: "#f3f4f6",
              borderRadius: 2,
              marginTop: 8
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Team Members */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Team Members</h2>
          <div style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16
          }}>
            {project.teamMembers.length === 0 ? (
              <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", padding: 20 }}>
                No team members assigned
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {project.teamMembers.map((member) => (
                  <div key={member.userId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 600
                    }}>
                      {member.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                        {member.fullName}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {member.role} • {member.department}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Project Info */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Project Information</h2>
          <div style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {project.description && (
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Description</span>
                  <p style={{ fontSize: 14, color: "#374151", margin: "4px 0 0 0" }}>
                    {project.description}
                  </p>
                </div>
              )}
              
              {project.startDate && (
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Start Date</span>
                  <p style={{ fontSize: 14, color: "#374151", margin: "4px 0 0 0" }}>
                    {new Date(project.startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </p>
                </div>
              )}
              
              {project.endDate && (
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>End Date</span>
                  <p style={{ fontSize: 14, color: "#374151", margin: "4px 0 0 0" }}>
                    {new Date(project.endDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </p>
                </div>
              )}
              
              <div>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Created By</span>
                <p style={{ fontSize: 14, color: "#374151", margin: "4px 0 0 0" }}>
                  {project.createdByName}
                </p>
              </div>
              
              <div>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Created On</span>
                <p style={{ fontSize: 14, color: "#374151", margin: "4px 0 0 0" }}>
                  {new Date(project.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Recent Transactions</h2>
        <div style={{
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden"
        }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <FileText size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Date</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Type</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Description</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Amount</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((transaction) => (
                    <tr key={transaction.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#374151" }}>
                        {new Date(transaction.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#374151" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {transaction.type === "expense" ? <Briefcase size={16} color="#3b82f6" /> : <Receipt size={16} color="#8b5cf6" />}
                          {transaction.type === "expense" ? "Expense" : "Vendor Bill"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#374151" }}>
                        {transaction.title}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#111827", textAlign: "right" }}>
                        {formatINR(transaction.amount)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: transaction.status === "approved" ? "#dcfce7" : 
                                         transaction.status === "pending" ? "#fef3c7" : "#fee2e2",
                          color: transaction.status === "approved" ? "#166534" : 
                                  transaction.status === "pending" ? "#d97706" : "#991b1b"
                        }}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > 10 && (
                <div style={{ padding: "12px 16px", textAlign: "center", borderTop: "1px solid #f3f4f6" }}>
                  <button
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#374151",
                      cursor: "pointer"
                    }}
                  >
                    View all transactions
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
