"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Filter, Plus, Upload, Mail, Building, FileText, CheckCircle, XCircle, Clock } from "lucide-react";

// INR currency formatter
const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { 
    style: "currency", 
    currency: "INR", 
    maximumFractionDigits: 0 
  }).format(amount);

interface Vendor {
  id: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  status: "active" | "inactive" | "pending";
  totalInvoices: number;
  totalAmount: number;
  lastPaymentDate?: string;
  contactPerson?: string;
}

interface Invoice {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  createdAt: string;
  paidAt?: string;
}

export default function VendorsPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showUploadInvoiceModal, setShowUploadInvoiceModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    category: "",
    email: "",
    phone: "",
    address: "",
    paymentTerms: "NET 30"
  });
  const [invoiceForm, setInvoiceForm] = useState({
    vendorId: "",
    invoiceNumber: "",
    amount: "",
    dueDate: ""
  });

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Fetch vendors
    const unsubscribeVendors = onSnapshot(
      query(collection(db, "vendors"), orderBy("name", "asc")),
      (snapshot) => {
        const vendorsData: Vendor[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          vendorsData.push({
            id: doc.id,
            name: data.name || "Unknown",
            category: data.category || "Other",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            paymentTerms: data.paymentTerms || "NET 30",
            status: data.status || "pending",
            totalInvoices: data.totalInvoices || 0,
            totalAmount: data.totalAmount || 0,
            lastPaymentDate: data.lastPaymentDate,
            contactPerson: data.contactPerson,
          });
        });
        setVendors(vendorsData);
      }
    );

    // Fetch invoices
    const unsubscribeInvoices = onSnapshot(
      query(collection(db, "invoices"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const invoicesData: Invoice[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          invoicesData.push({
            id: doc.id,
            vendorId: data.vendorId || "",
            vendorName: data.vendorName || "Unknown",
            invoiceNumber: data.invoiceNumber || "",
            amount: data.amount || 0,
            dueDate: data.dueDate || "",
            status: data.status || "pending",
            createdAt: data.createdAt || "",
            paidAt: data.paidAt,
          });
        });
        setInvoices(invoicesData);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeVendors();
      unsubscribeInvoices();
    };
  }, [user]);

  const handleAddVendor = async () => {
    if (!vendorForm.name || !vendorForm.email || !vendorForm.category) return;

    try {
      await addDoc(collection(db, "vendors"), {
        name: vendorForm.name,
        category: vendorForm.category,
        email: vendorForm.email,
        phone: vendorForm.phone,
        address: vendorForm.address,
        paymentTerms: vendorForm.paymentTerms,
        status: "pending",
        totalInvoices: 0,
        totalAmount: 0,
        createdAt: new Date().toISOString(),
      });

      setVendorForm({
        name: "",
        category: "",
        email: "",
        phone: "",
        address: "",
        paymentTerms: "NET 30"
      });
      setShowAddVendorModal(false);
    } catch (error) {
      console.error("Error adding vendor:", error);
    }
  };

  const handleUploadInvoice = async () => {
    if (!invoiceForm.vendorId || !invoiceForm.invoiceNumber || !invoiceForm.amount || !invoiceForm.dueDate) return;

    try {
      // Check for duplicate invoice
      const duplicateCheck = invoices.find(inv => 
        inv.invoiceNumber === invoiceForm.invoiceNumber && 
        inv.vendorId === invoiceForm.vendorId
      );

      if (duplicateCheck) {
        alert("Duplicate invoice detected! This invoice number already exists for this vendor.");
        return;
      }

      const vendor = vendors.find(v => v.id === invoiceForm.vendorId);
      
      await addDoc(collection(db, "invoices"), {
        vendorId: invoiceForm.vendorId,
        vendorName: vendor?.name || "Unknown",
        invoiceNumber: invoiceForm.invoiceNumber,
        amount: parseFloat(invoiceForm.amount),
        dueDate: invoiceForm.dueDate,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      setInvoiceForm({
        vendorId: "",
        invoiceNumber: "",
        amount: "",
        dueDate: ""
      });
      setShowUploadInvoiceModal(false);
    } catch (error) {
      console.error("Error uploading invoice:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      inactive: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
      pending: { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" },
      paid: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      overdue: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
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
    return formatINR(amount);
  };

  const canManageVendors = user?.role === "admin" || user?.role === "finance";

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInvoices = invoices.filter(invoice =>
    invoice.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              Manage vendor relationships and invoice processing
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            {canManageVendors && (
              <>
                <button
                  onClick={() => setShowAddVendorModal(true)}
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
                <button
                  onClick={() => setShowUploadInvoiceModal(true)}
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
                  <Upload size={16} />
                  Upload Invoice
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div 
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            padding: "20px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={20} style={{ color: "#6b7280" }} />
            <input
              type="text"
              placeholder="Search vendors or invoices..."
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
        </div>

        {/* Vendors Section */}
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
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>Vendors</h2>
          </div>
          <div style={{ padding: "20px" }}>
            {filteredVendors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <Building size={48} style={{ color: "#d1d5db", margin: "0 auto 16px" }} />
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                  No vendors found. {canManageVendors && "Add your first vendor to get started."}
                </p>
              </div>
            ) : (
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
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 4px 0" }}>
                          {vendor.name}
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          {getStatusBadge(vendor.status)}
                          <span style={{ fontSize: "13px", color: "#6b7280", padding: "4px 8px", backgroundColor: "#f3f4f6", borderRadius: "4px" }}>
                            {vendor.paymentTerms}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>Category:</span>
                        <span style={{ fontSize: "14px", color: "#374151" }}>{vendor.category}</span>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Mail size={14} style={{ color: "#6b7280" }} />
                        <span style={{ fontSize: "14px", color: "#374151" }}>{vendor.email}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #f3f4f6" }}>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 2px 0" }}>
                          {vendor.totalInvoices} invoices • {formatCurrency(vendor.totalAmount)}
                        </p>
                        {vendor.lastPaymentDate && (
                          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                            Last payment: {new Date(vendor.lastPaymentDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invoices Section */}
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
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>Recent Invoices</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <FileText size={48} style={{ color: "#d1d5db", margin: "0 auto 16px" }} />
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                  No invoices found. {canManageVendors && "Upload your first invoice to get started."}
                </p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Vendor
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Invoice Number
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Amount
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Due Date
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, index) => (
                    <tr 
                      key={invoice.id} 
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
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#111827", verticalAlign: "top", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {invoice.vendorName}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#374151", verticalAlign: "top", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {invoice.invoiceNumber}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#111827", verticalAlign: "top" }}>
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#374151", verticalAlign: "top" }}>
                        {new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      </td>
                      <td style={{ padding: "16px", verticalAlign: "top" }}>
                        {getStatusBadge(invoice.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add Vendor Modal */}
        {showAddVendorModal && (
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
            onClick={() => setShowAddVendorModal(false)}
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
                    Add New Vendor
                  </h2>
                  <button
                    onClick={() => setShowAddVendorModal(false)}
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
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Vendor Name</label>
                    <input
                      type="text"
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm({...vendorForm, name: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter vendor name"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Category</label>
                    <input
                      type="text"
                      value={vendorForm.category}
                      onChange={(e) => setVendorForm({...vendorForm, category: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter category"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Email</label>
                    <input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({...vendorForm, email: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter email address"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Phone</label>
                    <input
                      type="tel"
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({...vendorForm, phone: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter phone number"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Address</label>
                    <input
                      type="text"
                      value={vendorForm.address}
                      onChange={(e) => setVendorForm({...vendorForm, address: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter address"
                    />
                  </div>
                  
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowAddVendorModal(false)}
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
                      onClick={handleAddVendor}
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
                      Add Vendor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Invoice Modal */}
        {showUploadInvoiceModal && (
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
            onClick={() => setShowUploadInvoiceModal(false)}
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
                    Upload Invoice
                  </h2>
                  <button
                    onClick={() => setShowUploadInvoiceModal(false)}
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
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Vendor</label>
                    <select
                      value={invoiceForm.vendorId}
                      onChange={(e) => setInvoiceForm({...invoiceForm, vendorId: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Invoice Number</label>
                    <input
                      type="text"
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter invoice number"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Amount</label>
                    <input
                      type="number"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        width: "100%",
                        outline: "none"
                      }}
                      placeholder="Enter amount"
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px", display: "block" }}>Due Date</label>
                    <input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm({...invoiceForm, dueDate: e.target.value})}
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
                  
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowUploadInvoiceModal(false)}
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
                      onClick={handleUploadInvoice}
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
                      Upload Invoice
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
