"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Edit, Plus, TrendingUp, TrendingDown, DollarSign, CheckCircle, XCircle, Clock } from "lucide-react";

interface Department {
  id: string;
  name: string;
  budgetAmount: number;
  spent: number;
}

interface Expense {
  id: string;
  departmentId: string;
  amount: number;
  status: string;
}

interface BudgetProposal {
  id: string;
  departmentId: string;
  departmentName: string;
  requestedAmount: number;
  currentAmount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComment?: string;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [proposals, setProposals] = useState<BudgetProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [requestForm, setRequestForm] = useState({
    departmentId: "",
    requestedAmount: "",
    reason: ""
  });

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Fetch departments
    const unsubscribeDepartments = onSnapshot(
      collection(db, "departments"), 
      (snapshot) => {
        const departmentsData: Department[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const budgetAmount = data.budgetAmount || 0;
          departmentsData.push({
            id: doc.id,
            name: data.name || "Unknown",
            budgetAmount: budgetAmount,
            spent: 0, // Will be calculated from expenses
          });
        });
        setDepartments(departmentsData);
      }
    );

    // Fetch expenses
    const unsubscribeExpenses = onSnapshot(
      query(collection(db, "expenses"), where("status", "==", "approved")),
      (snapshot) => {
        const expensesData: Expense[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          expensesData.push({
            id: doc.id,
            departmentId: data.departmentId || "",
            amount: data.amount || 0,
            status: data.status || "",
          });
        });
        setExpenses(expensesData);
      }
    );

    // Fetch budget proposals
    const unsubscribeProposals = onSnapshot(
      query(collection(db, "budgetProposals"), orderBy("requestedAt", "desc")),
      (snapshot) => {
        const proposalsData: BudgetProposal[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          proposalsData.push({
            id: doc.id,
            departmentId: data.departmentId || "",
            departmentName: data.departmentName || "Unknown",
            requestedAmount: data.requestedAmount || 0,
            currentAmount: data.currentAmount || 0,
            reason: data.reason || "",
            status: data.status || "pending",
            requestedBy: data.requestedBy || "Unknown",
            requestedAt: data.requestedAt || "",
            reviewedAt: data.reviewedAt,
            reviewedBy: data.reviewedBy,
            reviewComment: data.reviewComment,
          });
        });
        setProposals(proposalsData);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeDepartments();
      unsubscribeExpenses();
      unsubscribeProposals();
    };
  }, [user]);

  // Calculate spent amount per department whenever departments or expenses change
  useEffect(() => {
    const departmentsWithSpending = departments.map(dept => {
      // Sum expenses for this department by matching departmentId
      const departmentExpenses = expenses.filter(expense => 
        expense.departmentId === dept.id
      );
      const spentAmount = departmentExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      return {
        ...dept,
        spent: spentAmount
      };
    });
    
    setDepartments(departmentsWithSpending);
  }, [expenses]);

  const handleBudgetUpdate = async () => {
    if (!selectedDepartment || !editAmount) return;

    try {
      await updateDoc(doc(db, "departments", selectedDepartment.id), {
        budgetAmount: parseFloat(editAmount),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.fullName,
      });
      
      // Add audit log
      await addDoc(collection(db, "auditLogs"), {
        recordType: "budget",
        reference: selectedDepartment.name,
        action: "Budget Updated",
        performedBy: user?.fullName,
        performedAt: new Date().toISOString(),
        amount: parseFloat(editAmount),
        previousAmount: selectedDepartment.budgetAmount,
        details: `Budget for ${selectedDepartment.name} updated from ${formatCurrency(selectedDepartment.budgetAmount)} to ${formatCurrency(parseFloat(editAmount))}`
      });

      setShowEditModal(false);
      setSelectedDepartment(null);
      setEditAmount("");
    } catch (error) {
      console.error("Error updating budget:", error);
    }
  };

  const handleBudgetRequest = async () => {
    if (!requestForm.departmentId || !requestForm.requestedAmount || !requestForm.reason) return;

    try {
      const department = departments.find(d => d.id === requestForm.departmentId);
      
      await addDoc(collection(db, "budgetProposals"), {
        departmentId: requestForm.departmentId,
        departmentName: department?.name || "Unknown",
        requestedAmount: parseFloat(requestForm.requestedAmount),
        currentAmount: department?.budgetAmount || 0,
        reason: requestForm.reason,
        status: "pending",
        requestedBy: user?.fullName,
        requestedAt: new Date().toISOString(),
      });

      // Add audit log
      await addDoc(collection(db, "auditLogs"), {
        recordType: "budget",
        reference: department?.name || "Unknown",
        action: "Budget Change Requested",
        performedBy: user?.fullName,
        performedAt: new Date().toISOString(),
        amount: parseFloat(requestForm.requestedAmount),
        details: `Budget change requested for ${department?.name}: ${formatCurrency(parseFloat(requestForm.requestedAmount))}`
      });

      setShowRequestModal(false);
      setRequestForm({ departmentId: "", requestedAmount: "", reason: "" });
    } catch (error) {
      console.error("Error creating budget request:", error);
    }
  };

  const handleProposalAction = async (proposalId: string, action: "approved" | "rejected", comment?: string) => {
    try {
      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) return;

      await updateDoc(doc(db, "budgetProposals", proposalId), {
        status: action,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.fullName,
        reviewComment: comment,
      });

      // If approved, update department budget
      if (action === "approved") {
        await updateDoc(doc(db, "departments", proposal.departmentId), {
          budgetAmount: proposal.requestedAmount,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.fullName,
        });

        // Add audit log for budget update
        await addDoc(collection(db, "auditLogs"), {
          recordType: "budget",
          reference: proposal.departmentName,
          action: "Budget Approved and Updated",
          performedBy: user?.fullName,
          performedAt: new Date().toISOString(),
          amount: proposal.requestedAmount,
          previousAmount: proposal.currentAmount,
          details: `Budget proposal approved for ${proposal.departmentName}. Budget updated from ${formatCurrency(proposal.currentAmount)} to ${formatCurrency(proposal.requestedAmount)}`
        });
      }

      // Add audit log for proposal review
      await addDoc(collection(db, "auditLogs"), {
        recordType: "budget",
        reference: proposal.departmentName,
        action: `Budget Proposal ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        performedBy: user?.fullName,
        performedAt: new Date().toISOString(),
        amount: proposal.requestedAmount,
        details: `Budget change proposal for ${proposal.departmentName} ${action}${comment ? ` - ${comment}` : ""}`
      });

    } catch (error) {
      console.error("Error handling proposal action:", error);
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

  const canEditBudget = user?.role === "admin";
  const canRequestBudget = user?.role === "manager";
  const canApproveBudget = user?.role === "admin" || user?.role === "finance";

  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div style={{ height: "32px", backgroundColor: "#f3f4f6", borderRadius: "4px", width: "200px" }}></div>
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
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: "100px", backgroundColor: "#f3f4f6", borderRadius: "4px", marginBottom: "16px" }}></div>
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
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: "0 0 8px 0" }}>Budgets</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              Manage department budgets and review change proposals
            </p>
          </div>
          {canRequestBudget && (
            <button
              onClick={() => setShowRequestModal(true)}
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
              Request Budget Change
            </button>
          )}
        </div>

        {/* Department Budget Overview */}
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
            {departments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <DollarSign size={48} style={{ color: "#d1d5db", margin: "0 auto 16px" }} />
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                  No departments found. Please add departments to get started.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {departments.map((dept) => {
                  const percentage = dept.budgetAmount > 0 ? (dept.spent / dept.budgetAmount) * 100 : 0;
                  const remaining = dept.budgetAmount - dept.spent;
                  const isOverBudget = dept.spent > dept.budgetAmount;
                  
                  return (
                    <div key={dept.id} style={{ 
                      border: "1px solid #e5e7eb", 
                      borderRadius: "8px", 
                      padding: "16px",
                      backgroundColor: "#ffffff"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
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
                            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                              {dept.name}
                            </h3>
                          </div>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "12px" }}>
                            <div>
                              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px 0" }}>Allocated Budget</p>
                              <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                                {formatCurrency(dept.budgetAmount)}
                              </p>
                            </div>
                            <div>
                              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px 0" }}>Amount Spent</p>
                              <p style={{ fontSize: "16px", fontWeight: "600", color: "#374151", margin: 0 }}>
                                {formatCurrency(dept.spent)}
                              </p>
                            </div>
                            <div>
                              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px 0" }}>Remaining Balance</p>
                              <p style={{ 
                                fontSize: "16px", 
                                fontWeight: "600", 
                                color: remaining >= 0 ? "#111827" : "#ef4444", 
                                margin: 0 
                              }}>
                                {formatCurrency(Math.abs(remaining))}
                                {remaining < 0 && <span style={{ fontSize: "12px", marginLeft: "4px" }}>Over Budget</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {canEditBudget && (
                          <button
                            onClick={() => {
                              setSelectedDepartment(dept);
                              setEditAmount(dept.budgetAmount.toString());
                              setShowEditModal(true);
                            }}
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
                          <Edit size={14} />
                          Edit Budget
                        </button>
                      )}
                    </div>
                    
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px", color: "#6b7280" }}>
                          {percentage.toFixed(1)}% of budget used
                        </span>
                        {isOverBudget && (
                          <span 
                            className="px-2 py-1 rounded-full text-xs font-semibold inline-block"
                            style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
                          >
                            Over Budget
                          </span>
                        )}
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
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* Budget Change Proposals */}
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
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>Budget Change Proposals</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            {proposals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <Clock size={48} style={{ color: "#d1d5db", margin: "0 auto 16px" }} />
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                  No budget proposals found. {canRequestBudget && "Create your first budget change request."}
                </p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Department
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Current Amount
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Requested Amount
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Reason
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Requested By
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Status
                    </th>
                    {canApproveBudget && (
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((proposal, index) => (
                    <tr 
                      key={proposal.id} 
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
                        {proposal.departmentName}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#374151" }}>
                        {formatCurrency(proposal.currentAmount)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                        {formatCurrency(proposal.requestedAmount)}
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                          {proposal.requestedAmount > proposal.currentAmount ? (
                            <span style={{ color: "#10b981" }}>
                              <TrendingUp size={12} style={{ marginRight: "4px" }} />
                              +{formatCurrency(proposal.requestedAmount - proposal.currentAmount)}
                            </span>
                          ) : (
                            <span style={{ color: "#ef4444" }}>
                              <TrendingDown size={12} style={{ marginRight: "4px" }} />
                              -{formatCurrency(proposal.currentAmount - proposal.requestedAmount)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#374151", maxWidth: "200px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {proposal.reason}
                        </div>
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#374151" }}>
                        <div>
                          <div style={{ fontWeight: "500" }}>{proposal.requestedBy}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            {new Date(proposal.requestedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px" }}>
                        {getStatusBadge(proposal.status)}
                      </td>
                      {canApproveBudget && (
                        <td style={{ padding: "16px" }}>
                          {proposal.status === "pending" && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleProposalAction(proposal.id, "approved")}
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
                                onClick={() => handleProposalAction(proposal.id, "rejected")}
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
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Edit Budget Modal */}
        {showEditModal && selectedDepartment && (
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
            onClick={() => setShowEditModal(false)}
          >
            <div 
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                maxWidth: "400px",
                width: "90%"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                    Edit Budget - {selectedDepartment.name}
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
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
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Current Budget</label>
                    <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                      {formatCurrency(selectedDepartment.budgetAmount)}
                    </p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>New Budget Amount</label>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter new budget amount"
                    />
                  </div>
                  
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowEditModal(false)}
                      style={{
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBudgetUpdate}
                      style={{
                        backgroundColor: "#10b981",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer"
                      }}
                    >
                      Update Budget
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Request Budget Change Modal */}
        {showRequestModal && (
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
            onClick={() => setShowRequestModal(false)}
          >
            <div 
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                maxWidth: "500px",
                width: "90%"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                    Request Budget Change
                  </h2>
                  <button
                    onClick={() => setShowRequestModal(false)}
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
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Department</label>
                    <select
                      value={requestForm.departmentId}
                      onChange={(e) => setRequestForm({...requestForm, departmentId: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} (Current: {formatCurrency(dept.budgetAmount)})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Requested Amount</label>
                    <input
                      type="number"
                      value={requestForm.requestedAmount}
                      onChange={(e) => setRequestForm({...requestForm, requestedAmount: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter requested budget amount"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Reason for Change</label>
                    <textarea
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        minHeight: "80px",
                        outline: "none",
                        resize: "vertical"
                      }}
                      placeholder="Explain why this budget change is needed..."
                    />
                  </div>
                  
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowRequestModal(false)}
                      style={{
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBudgetRequest}
                      style={{
                        backgroundColor: "#10b981",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer"
                      }}
                    >
                      Submit Request
                    </button>
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
