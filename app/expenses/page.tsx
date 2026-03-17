"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Filter, Plus, Download, Eye, CheckCircle, XCircle, Clock } from "lucide-react";

interface Expense {
  id: string;
  employeeName: string;
  category: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "rejected";
  description: string;
  department: string;
  receiptUrl?: string;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    
    let q = query(collection(db, "expenses"), orderBy("date", "desc"));
    
    // Employees can only see their own expenses
    if (user.role === "employee") {
      q = query(q, where("employeeId", "==", user.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData: Expense[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        expensesData.push({
          id: doc.id,
          employeeName: data.employeeName || "Unknown",
          category: data.category || "Other",
          amount: data.amount || 0,
          date: data.date || "",
          status: data.status || "pending",
          description: data.description || "",
          department: data.department || "Unknown",
          receiptUrl: data.receiptUrl,
        });
      });
      setExpenses(expensesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching expenses:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleStatusUpdate = async (expenseId: string, newStatus: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "expenses", expenseId), {
        status: newStatus,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.fullName,
      });
    } catch (error) {
      console.error("Error updating expense status:", error);
    }
  };

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canApproveReject = user?.role === "admin" || user?.role === "finance" || user?.role === "manager";

  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ height: "32px", backgroundColor: "#f3f4f6", borderRadius: "4px", width: "200px" }}></div>
            <div style={{ height: "40px", backgroundColor: "#f3f4f6", borderRadius: "8px", width: "120px" }}></div>
          </div>
          <div 
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px"
            }}
          >
            <div className="animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ height: "60px", backgroundColor: "#f3f4f6", borderRadius: "4px", marginBottom: "12px" }}></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: "0 0 8px 0" }}>Expenses</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              Manage and track all expense submissions
            </p>
          </div>
          <button
            style={{
              backgroundColor: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Plus size={16} />
            New Expense
          </button>
        </div>

        {/* Filters */}
        <div 
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            padding: "20px"
          }}
        >
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "200px" }}>
              <Search size={20} style={{ color: "#6b7280" }} />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  width: "100%",
                  outline: "none"
                }}
              />
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={20} style={{ color: "#6b7280" }} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  outline: "none"
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              style={{
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {/* Expenses Table */}
        <div 
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }}
        >
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
                  {canApproveReject && (
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense, index) => (
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
                    <td style={{ padding: "16px" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "500", color: "#111827", marginBottom: "2px" }}>
                          {expense.employeeName}
                        </div>
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>
                          {expense.department}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#374151" }}>
                      {expense.category}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                      {formatCurrency(expense.amount)}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#374151" }}>
                      {new Date(expense.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "16px" }}>
                      {getStatusBadge(expense.status)}
                    </td>
                    {canApproveReject && (
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {expense.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(expense.id, "approved")}
                                style={{
                                  backgroundColor: "#dcfce7",
                                  color: "#166534",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: "6px",
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                <CheckCircle size={14} />
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(expense.id, "rejected")}
                                style={{
                                  backgroundColor: "#fee2e2",
                                  color: "#991b1b",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                <XCircle size={14} />
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedExpense(expense)}
                            style={{
                              backgroundColor: "#f3f4f6",
                              color: "#374151",
                              border: "1px solid #e5e7eb",
                              borderRadius: "6px",
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: "500",
                              cursor: "pointer",
                              display: "flex",
                                  alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Detail Modal */}
        {selectedExpense && (
          <div 
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000
            }}
            onClick={() => setSelectedExpense(null)}
          >
            <div 
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                maxWidth: "500px",
                width: "90%",
                maxHeight: "90vh",
                overflow: "auto"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                    Expense Details
                  </h2>
                  <button
                    onClick={() => setSelectedExpense(null)}
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      fontSize: "20px",
                      cursor: "pointer",
                      color: "#6b7280"
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Employee</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedExpense.employeeName}</p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Department</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedExpense.department}</p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Category</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedExpense.category}</p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Amount</label>
                    <p style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                      {formatCurrency(selectedExpense.amount)}
                    </p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Date</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>
                      {new Date(selectedExpense.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Status</label>
                    <div style={{ marginTop: "4px" }}>
                      {getStatusBadge(selectedExpense.status)}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Description</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0, lineHeight: "1.5" }}>
                      {selectedExpense.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
