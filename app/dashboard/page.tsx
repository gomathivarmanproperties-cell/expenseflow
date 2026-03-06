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
  getDocs,
  sum
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  FileText,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  budget: number;
  spent: number;
}

interface Expense {
  id: string;
  employeeName: string;
  category: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "rejected";
  description: string;
}

interface Invoice {
  id: string;
  vendorName: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
}

interface SummaryData {
  totalBudget: number;
  totalSpent: number;
  pendingExpenses: number;
  pendingInvoices: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalBudget: 0,
    totalSpent: 0,
    pendingExpenses: 0,
    pendingInvoices: 0,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Real-time listeners
    const unsubscribeDepartments = onSnapshot(
      collection(db, "departments"),
      (snapshot) => {
        const depts: Department[] = [];
        let totalBudget = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const dept = {
            id: doc.id,
            name: data.name || "Unknown",
            budget: data.budget || 0,
            spent: data.spent || 0,
          };
          depts.push(dept);
          totalBudget += dept.budget;
        });

        setDepartments(depts);
        setSummaryData(prev => ({ ...prev, totalBudget }));
      },
      (error) => {
        console.error("Error fetching departments:", error);
      }
    );

    const unsubscribeExpenses = onSnapshot(
      query(
        collection(db, "expenses"),
        orderBy("date", "desc"),
        limit(5)
      ),
      (snapshot) => {
        const expenses: Expense[] = [];
        let totalSpent = 0;
        let pendingCount = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const expense = {
            id: doc.id,
            employeeName: data.employeeName || "Unknown",
            category: data.category || "Other",
            amount: data.amount || 0,
            date: data.date || "",
            status: data.status || "pending",
            description: data.description || "",
          };
          expenses.push(expense);
          
          if (expense.status === "approved") {
            totalSpent += expense.amount;
          }
          if (expense.status === "pending") {
            pendingCount++;
          }
        });

        setRecentExpenses(expenses);
        setSummaryData(prev => ({ 
          ...prev, 
          totalSpent, 
          pendingExpenses: pendingCount 
        }));
      },
      (error) => {
        console.error("Error fetching expenses:", error);
      }
    );

    // Only fetch invoices for Admin and Finance roles
    if (user.role === "admin" || user.role === "finance") {
      const unsubscribeInvoices = onSnapshot(
        query(collection(db, "invoices"), where("status", "==", "pending")),
        (snapshot) => {
          setSummaryData(prev => ({ 
            ...prev, 
            pendingInvoices: snapshot.size 
          }));
        },
        (error) => {
          console.error("Error fetching invoices:", error);
        }
      );

      setLoading(false);
      return () => {
        unsubscribeDepartments();
        unsubscribeExpenses();
        unsubscribeInvoices();
      };
    }

    setLoading(false);
    return () => {
      unsubscribeDepartments();
      unsubscribeExpenses();
    };
  }, [user]);

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" },
      approved: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      rejected: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
    };
    
    const style = styles[status as keyof typeof styles] || styles.pending;
    
    return (
      <span 
        className="px-3 py-1 rounded-full text-xs font-semibold inline-block"
        style={style}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 85) return "#10b981";
    if (percentage <= 100) return "#f59e0b";
    return "#ef4444";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Loading skeleton for summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  padding: "20px"
                }}
              >
                <div className="animate-pulse">
                  <div style={{ height: "16px", backgroundColor: "#f3f4f6", borderRadius: "4px", width: "50%", marginBottom: "16px" }}></div>
                  <div style={{ height: "32px", backgroundColor: "#f3f4f6", borderRadius: "4px", width: "75%" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
          {/* Total Budget Card */}
          <div 
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
              transition: "box-shadow 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Total Budget</p>
                <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {formatCurrency(summaryData.totalBudget)}
                </p>
              </div>
              <div 
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  backgroundColor: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <DollarSign size={24} style={{ color: "#ffffff" }} />
              </div>
            </div>
          </div>

          {/* Total Spent Card */}
          <div 
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
              transition: "box-shadow 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Total Spent</p>
                <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {formatCurrency(summaryData.totalSpent)}
                </p>
              </div>
              <div 
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  backgroundColor: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <TrendingUp size={24} style={{ color: "#ffffff" }} />
              </div>
            </div>
          </div>

          {/* Pending Expenses Card */}
          <div 
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px",
              transition: "box-shadow 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Pending Expenses</p>
                <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {summaryData.pendingExpenses}
                </p>
              </div>
              <div 
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  backgroundColor: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Clock size={24} style={{ color: "#ffffff" }} />
              </div>
            </div>
          </div>

          {/* Pending Invoices Card - Only for Admin and Finance */}
          {(user?.role === "admin" || user?.role === "finance") && (
            <div 
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: "20px",
                transition: "box-shadow 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Pending Invoices</p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                    {summaryData.pendingInvoices}
                  </p>
                </div>
                <div 
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    backgroundColor: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <FileText size={24} style={{ color: "#ffffff" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Department Budget Overview - Only for Admin, Finance, and Manager */}
        {(user?.role === "admin" || user?.role === "finance" || user?.role === "manager") && (
          <div 
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>Department Budget Overview</h2>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {departments.map((dept) => {
                  const percentage = dept.budget > 0 ? (dept.spent / dept.budget) * 100 : 0;
                  const isOverBudget = dept.spent > dept.budget;
                  
                  return (
                    <div key={dept.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div 
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: "#10b981",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ffffff",
                              fontSize: "14px",
                              fontWeight: "600"
                            }}
                          >
                            {dept.name.charAt(0)}
                          </div>
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827", margin: "0 0 2px 0" }}>{dept.name}</p>
                            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
                              {formatCurrency(dept.spent)} of {formatCurrency(dept.budget)}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                            {percentage.toFixed(1)}%
                          </span>
                          {isOverBudget && (
                            <span 
                              className="px-3 py-1 rounded-full text-xs font-semibold inline-block"
                              style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
                            >
                              Over Budget
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ width: "100%", backgroundColor: "#f3f4f6", borderRadius: "999px", height: "8px" }}>
                        <div
                          style={{
                            height: "8px",
                            borderRadius: "999px",
                            backgroundColor: getProgressColor(percentage),
                            width: `${Math.min(percentage, 100)}%`,
                            transition: "all 0.3s ease"
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div 
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }}
        >
          <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>Recent Activity</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Employee
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Category
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Amount
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Date
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((expense, index) => (
                  <tr 
                    key={expense.id} 
                    style={{ 
                      borderBottom: "1px solid #f3f4f6",
                      backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa",
                      transition: "background-color 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? "#ffffff" : "#fafafa";
                    }}
                  >
                    <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                      {expense.employeeName}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#374151" }}>
                      {expense.category}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                      {formatCurrency(expense.amount)}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#374151" }}>
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "16px" }}>
                      {getStatusBadge(expense.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

