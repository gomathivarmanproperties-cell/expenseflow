"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Filter, Plus, Phone, Mail, MapPin, Building, CheckCircle, XCircle, Clock } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: "active" | "inactive" | "pending";
  totalInvoices: number;
  totalAmount: number;
  lastPaymentDate?: string;
  contactPerson?: string;
}

export default function VendorsPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    
    const q = query(collection(db, "vendors"), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vendorsData: Vendor[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        vendorsData.push({
          id: doc.id,
          name: data.name || "Unknown",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          category: data.category || "Other",
          status: data.status || "pending",
          totalInvoices: data.totalInvoices || 0,
          totalAmount: data.totalAmount || 0,
          lastPaymentDate: data.lastPaymentDate,
          contactPerson: data.contactPerson,
        });
      });
      setVendors(vendorsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching vendors:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleStatusUpdate = async (vendorId: string, newStatus: "active" | "inactive") => {
    try {
      await updateDoc(doc(db, "vendors", vendorId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.fullName,
      });
    } catch (error) {
      console.error("Error updating vendor status:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      inactive: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
      pending: { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" },
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

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
                <div key={i} style={{ height: "80px", backgroundColor: "#f3f4f6", borderRadius: "4px", marginBottom: "12px" }}></div>
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
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: "0 0 8px 0" }}>Vendors</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              Manage vendor relationships and payment information
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
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
            Add Vendor
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div 
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "20px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Total Vendors</p>
                <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {vendors.length}
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
                <Building size={24} style={{ color: "#ffffff" }} />
              </div>
            </div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Active Vendors</p>
                <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {vendors.filter(v => v.status === "active").length}
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
                <CheckCircle size={24} style={{ color: "#ffffff" }} />
              </div>
            </div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "500", color: "#374151", margin: "0 0 8px 0" }}>Total Invoices</p>
                <p style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {vendors.reduce((sum, v) => sum + v.totalInvoices, 0)}
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
                placeholder="Search vendors..."
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vendors Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "16px" }}>
          {filteredVendors.map((vendor) => (
            <div 
              key={vendor.id}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: "20px",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              onClick={() => setSelectedVendor(vendor)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 4px 0" }}>
                    {vendor.name}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
                    {vendor.category}
                  </p>
                </div>
                {getStatusBadge(vendor.status)}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {vendor.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Mail size={14} style={{ color: "#6b7280" }} />
                    <span style={{ fontSize: "13px", color: "#374151" }}>{vendor.email}</span>
                  </div>
                )}
                {vendor.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Phone size={14} style={{ color: "#6b7280" }} />
                    <span style={{ fontSize: "13px", color: "#374151" }}>{vendor.phone}</span>
                  </div>
                )}
                {vendor.address && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={14} style={{ color: "#6b7280" }} />
                    <span style={{ fontSize: "13px", color: "#374151" }}>{vendor.address}</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #f3f4f6" }}>
                <div>
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px 0" }}>
                    {vendor.totalInvoices} invoices • {formatCurrency(vendor.totalAmount)}
                  </p>
                  {vendor.lastPaymentDate && (
                    <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                      Last payment: {new Date(vendor.lastPaymentDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {vendor.status === "pending" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(vendor.id, "active");
                        }}
                        style={{
                          backgroundColor: "#dcfce7",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: "500",
                          cursor: "pointer"
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(vendor.id, "inactive");
                        }}
                        style={{
                          backgroundColor: "#fee2e2",
                          color: "#991b1b",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: "500",
                          cursor: "pointer"
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Vendor Detail Modal */}
        {selectedVendor && (
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
            onClick={() => setSelectedVendor(null)}
          >
            <div 
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                maxWidth: "600px",
                width: "90%",
                maxHeight: "90vh",
                overflow: "auto"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                    {selectedVendor.name}
                  </h2>
                  <button
                    onClick={() => setSelectedVendor(null)}
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
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Category</label>
                      <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedVendor.category}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Status</label>
                      <div style={{ marginTop: "4px" }}>
                        {getStatusBadge(selectedVendor.status)}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Email</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedVendor.email}</p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Phone</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedVendor.phone}</p>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Address</label>
                    <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedVendor.address}</p>
                  </div>
                  
                  {selectedVendor.contactPerson && (
                    <div>
                      <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Contact Person</label>
                      <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>{selectedVendor.contactPerson}</p>
                    </div>
                  )}
                  
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Total Invoices</label>
                      <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                        {selectedVendor.totalInvoices}
                      </p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Total Amount</label>
                      <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                        {formatCurrency(selectedVendor.totalAmount)}
                      </p>
                    </div>
                  </div>
                  
                  {selectedVendor.lastPaymentDate && (
                    <div>
                      <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Last Payment Date</label>
                      <p style={{ fontSize: "14px", color: "#111827", margin: 0 }}>
                        {new Date(selectedVendor.lastPaymentDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
