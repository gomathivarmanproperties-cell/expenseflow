"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, limit, startAfter, onSnapshot, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Filter, FileText, DollarSign, TrendingUp, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  recordType: "expense" | "invoice" | "budget";
  reference: string;
  action: string;
  performedBy: string;
  createdAt: Timestamp | string | null;
  amount?: number;
  previousAmount?: number;
  details?: string;
}

export default function AuditTrailPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const pageSize = 20;

  // Helper function to format Firestore Timestamp or string date
  const formatDate = (timestamp: Timestamp | string | null): string => {
    if (!timestamp) {
      return "No date";
    }
    
    try {
      let date: Date;
      
      if (timestamp instanceof Timestamp) {
        // Handle Firestore Timestamp
        date = timestamp.toDate();
      } else if (typeof timestamp === 'string') {
        // Handle string date
        date = new Date(timestamp);
      } else {
        return "Invalid date";
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      
      // Format as "Mar 5, 2026 10:30 AM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error("Error formatting date:", error, timestamp);
      return "Invalid date";
    }
  };

  // Helper function to format date for display in table rows
  const formatTableDate = (timestamp: Timestamp | string | null): { date: string; time: string } => {
    if (!timestamp) {
      return { date: "No date", time: "" };
    }
    
    try {
      let date: Date;
      
      if (timestamp instanceof Timestamp) {
        date = timestamp.toDate();
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return { date: "Invalid date", time: "" };
      }
      
      if (isNaN(date.getTime())) {
        return { date: "Invalid date", time: "" };
      }
      
      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        time: date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      };
    } catch (error) {
      console.error("Error formatting table date:", error, timestamp);
      return { date: "Invalid date", time: "" };
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    // Only show to Admin, Finance, and Manager roles
    if (!["admin", "finance", "manager"].includes(user.role)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Simple query first - no ordering to test basic connection
      const q = query(
        collection(db, "auditLogs"),
        limit(pageSize)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setLogs([]);
          setLoading(false);
          return;
        }

        const logsData: AuditLog[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // Special handling for createdAt field
          let createdAtValue = data.createdAt || null;
          
          const logEntry: AuditLog = {
            id: doc.id,
            recordType: data.recordType || "expense",
            reference: data.reference || "Unknown",
            action: data.action || "Unknown",
            performedBy: data.performedBy || "Unknown",
            createdAt: createdAtValue,
            amount: data.amount,
            previousAmount: data.previousAmount,
            details: data.details,
          };
          
          logsData.push(logEntry);
        });
        
        setLogs(logsData);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.docs.length === pageSize);
        setLoading(false);
        
      }, (error) => {
        console.error("Firestore error:", error);
        setError("Failed to load audit logs: " + error.message);
        setLoading(false);
      });
      
      return () => {
        unsubscribe();
      };
      
    } catch (error) {
      console.error("Query setup error:", error);
      setError("Failed to setup query: " + error);
      setLoading(false);
    }
  }, [user]);

  const loadMore = async () => {
    if (!lastVisible || loadingMore || !hasMore) return;

    setLoadingMore(true);
    
    try {
      const q = query(
        collection(db, "auditLogs"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(pageSize)
      );

      console.log("Loading more logs...");
      const snapshot = await getDocs(q);
      const newLogs: AuditLog[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        newLogs.push({
          id: doc.id,
          recordType: data.recordType || "expense",
          reference: data.reference || "Unknown",
          action: data.action || "Unknown",
          performedBy: data.performedBy || "Unknown",
          createdAt: data.createdAt || null,
          amount: data.amount,
          previousAmount: data.previousAmount,
          details: data.details,
        });
      });

      setLogs(prev => [...prev, ...newLogs]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === pageSize);
    } catch (error) {
      console.error("Error loading more logs:", error);
      setError("Failed to load more logs");
    } finally {
      setLoadingMore(false);
    }
  };

  const getRecordTypeBadge = (recordType: string) => {
    const styles = {
      expense: { backgroundColor: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd" },
      invoice: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
      budget: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
    };
    
    const style = styles[recordType as keyof typeof styles] || styles.expense;
    
    return (
      <span 
        className="px-3 py-1 rounded-full text-xs font-semibold inline-block"
        style={style}
      >
        {recordType.charAt(0).toUpperCase() + recordType.slice(1)}
      </span>
    );
  };

  const getActionIcon = (action: string) => {
    if (action.includes("Created") || action.includes("Added")) {
      return <TrendingUp size={16} style={{ color: "#10b981" }} />;
    }
    if (action.includes("Updated") || action.includes("Modified")) {
      return <Clock size={16} style={{ color: "#f59e0b" }} />;
    }
    if (action.includes("Deleted") || action.includes("Rejected")) {
      return <FileText size={16} style={{ color: "#ef4444" }} />;
    }
    return <FileText size={16} style={{ color: "#6b7280" }} />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = recordTypeFilter === "all" || log.recordType === recordTypeFilter;
    return matchesSearch && matchesType;
  });

  // Only show to Admin, Finance, and Manager roles
  if (!user || !["admin", "finance", "manager"].includes(user.role)) {
    return (
      <main style={{ padding: "24px" }}>
        <div 
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            padding: "40px",
            textAlign: "center"
          }}
        >
          <FileText size={48} style={{ color: "#d1d5db", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: "0 0 8px 0" }}>
            Access Denied
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            You don't have permission to view audit trail.
          </p>
        </div>
      </main>
    );
  }

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
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: "0 0 8px 0" }}>Audit Trail</h1>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            Track all system activities and changes across expenses, invoices, and budgets
          </p>
        </div>

        
        {/* Error Display */}
        {error && (
          <div 
            style={{
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "12px 16px",
              fontSize: "14px"
            }}
          >
            {error}
          </div>
        )}

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
                placeholder="Search by reference, user, or action..."
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
                value={recordTypeFilter}
                onChange={(e) => setRecordTypeFilter(e.target.value)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  outline: "none"
                }}
              >
                <option value="all">All Records</option>
                <option value="expense">Expenses</option>
                <option value="invoice">Invoices</option>
                <option value="budget">Budgets</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Logs */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                System Activity Logs
              </h2>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>
                {filteredLogs.length} records
              </span>
            </div>
          </div>
          
          <div>
            {filteredLogs.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <FileText size={48} style={{ color: "#d1d5db", margin: "0 auto 16px" }} />
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                  {logs.length === 0 
                    ? "No audit logs found in 'auditLogs' collection." 
                    : "No audit logs found matching your criteria."
                  }
                </p>
                <p style={{ fontSize: "12px", color: "#9ca3af", margin: "8px 0 0 0" }}>
                  Check browser console for detailed debugging information.
                </p>
              </div>
            ) : (
              <div>
                {filteredLogs.map((log, index) => {
                  const formattedDate = formatTableDate(log.createdAt);
                  return (
                    <div
                      key={log.id}
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
                      <div 
                        style={{ padding: "16px", cursor: "pointer" }}
                        onClick={() => toggleLogExpansion(log.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {expandedLogs.has(log.id) ? 
                              <ChevronDown size={16} style={{ color: "#6b7280" }} /> : 
                              <ChevronRight size={16} style={{ color: "#6b7280" }} />
                            }
                            {getActionIcon(log.action)}
                          </div>
                          
                          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                              {getRecordTypeBadge(log.recordType)}
                              <div>
                                <div style={{ fontSize: "14px", fontWeight: "500", color: "#111827", marginBottom: "2px" }}>
                                  {log.action}
                                </div>
                                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                                  {log.reference} • by {log.performedBy}
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "2px" }}>
                                {formattedDate.date}
                              </div>
                              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                                {formattedDate.time}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {expandedLogs.has(log.id) && (
                          <div style={{ marginTop: "12px", paddingLeft: "28px" }}>
                            {log.details && (
                              <div style={{ marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", color: "#6b7280", marginRight: "8px" }}>Details:</span>
                                <span style={{ fontSize: "13px", color: "#374151" }}>{log.details}</span>
                              </div>
                            )}
                            
                            {log.amount !== undefined && (
                              <div style={{ marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", color: "#6b7280", marginRight: "8px" }}>Amount:</span>
                                <span style={{ fontSize: "13px", fontWeight: "500", color: "#111827" }}>
                                  {formatCurrency(log.amount)}
                                </span>
                                {log.previousAmount !== undefined && (
                                  <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>
                                    (Previous: {formatCurrency(log.previousAmount)})
                                  </span>
                                )}
                              </div>
                            )}
                            
                            <div>
                              <span style={{ fontSize: "12px", color: "#6b7280", marginRight: "8px" }}>Timestamp:</span>
                              <span style={{ fontSize: "13px", color: "#374151" }}>
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Load More Button */}
          {hasMore && filteredLogs.length > 0 && (
            <div style={{ padding: "16px", textAlign: "center", borderTop: "1px solid #e5e7eb" }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 24px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  opacity: loadingMore ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  margin: "0 auto"
                }}
              >
                {loadingMore ? (
                  <>
                    <div style={{ 
                      width: "16px", 
                      height: "16px", 
                      border: "2px solid #ffffff", 
                      borderTop: "2px solid transparent", 
                      borderRadius: "50%", 
                      animation: "spin 1s linear infinite" 
                    }}></div>
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
