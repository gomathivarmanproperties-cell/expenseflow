"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  UserX, 
  UserCheck,
  Mail,
  Phone,
  Building,
  Briefcase,
  CreditCard,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  X
} from "lucide-react";

interface User {
  id: string;
  fullName: string;
  email: string;
  role: "employee" | "manager" | "finance" | "admin";
  department?: string;
  designation?: string;
  phone?: string;
  assignedApproverId?: string;
  assignedApproverName?: string;
  status: "active" | "inactive";
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  createdAt?: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "employee" as const,
    department: "",
    designation: "",
    phone: "",
    assignedApproverId: "",
    status: "active" as const,
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountHolderName: ""
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load users
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const q = query(collection(db, "users"), orderBy("fullName"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as User);
      });
      setUsers(usersData);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Get managers and admins for approver dropdown
  const [approvers, setApprovers] = useState<User[]>([]);
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const q = query(
      collection(db, "users"), 
      where("role", "in", ["manager", "admin"]),
      where("status", "==", "active")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const approversData: User[] = [];
      snapshot.forEach((doc) => {
        approversData.push({ id: doc.id, ...doc.data() } as User);
      });
      setApprovers(approversData);
    });

    return unsubscribe;
  }, [user]);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;

    setSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        await updateDoc(doc(db, "users", editingUser.id), {
          fullName: formData.fullName,
          role: formData.role,
          department: formData.department,
          designation: formData.designation,
          phone: formData.phone,
          assignedApproverId: formData.assignedApproverId || null,
          assignedApproverName: approvers.find(a => a.id === formData.assignedApproverId)?.fullName || null,
          status: formData.status,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          accountHolderName: formData.accountHolderName
        });
        showToast("User updated successfully!", "success");
      } else {
        // Create new user via Firebase Auth REST API
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              displayName: formData.fullName,
              returnSecureToken: true
            })
          }
        );

        if (!response.ok) {
          throw new Error("Failed to create user in Firebase Auth");
        }

        const authData = await response.json();
        
        // Save to Firestore
        await setDoc(doc(db, "users", authData.localId), {
          fullName: formData.fullName,
          email: formData.email,
          role: formData.role,
          department: formData.department,
          designation: formData.designation,
          phone: formData.phone,
          assignedApproverId: formData.assignedApproverId || null,
          assignedApproverName: approvers.find(a => a.id === formData.assignedApproverId)?.fullName || null,
          status: formData.status,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          accountHolderName: formData.accountHolderName,
          createdAt: new Date().toISOString()
        });

        showToast("User created successfully!", "success");
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving user:", error);
      showToast(editingUser ? "Failed to update user." : "Failed to create user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      password: "",
      role: "employee",
      department: "",
      designation: "",
      phone: "",
      assignedApproverId: "",
      status: "active",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      accountHolderName: ""
    });
    setEditingUser(null);
    setShowBankDetails(false);
    setShowPassword(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      department: user.department || "",
      designation: user.designation || "",
      phone: user.phone || "",
      assignedApproverId: user.assignedApproverId || "",
      status: user.status,
      bankName: user.bankName || "",
      accountNumber: user.accountNumber || "",
      ifscCode: user.ifscCode || "",
      accountHolderName: user.accountHolderName || ""
    });
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    if (!user || user.role !== "admin") return;

    try {
      await deleteDoc(doc(db, "users", userId));
      showToast("User removed from app. Remove from Firebase Console to revoke login access.", "success");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      showToast("Failed to delete user.", "error");
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    if (!user || user.role !== "admin") return;

    const newStatus = currentStatus === "active" ? "inactive" : "active";
    
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      showToast(`User ${newStatus} successfully!`, "success");
      setShowDeactivateConfirm(null);
    } catch (error) {
      console.error("Error updating user status:", error);
      showToast("Failed to update user status.", "error");
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      inactive: { backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }
    };
    return { ...styles[status as keyof typeof styles], padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600 };
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      admin: { backgroundColor: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff" },
      finance: { backgroundColor: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" },
      manager: { backgroundColor: "#fed7aa", color: "#ea580c", border: "1px solid #fed7aa" },
      employee: { backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }
    };
    return { ...styles[role as keyof typeof styles], padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600 };
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 8px 0" }}>User Management</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Manage users, roles, and access permissions</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <Plus size={16} />
          Add New User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <div style={{ position: "relative" }}>
            <Search size={20} style={{ position: "absolute", left: 12, top: 12, color: "#6b7280" }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 12px 12px 40px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#10b981"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
            />
          </div>
        </div>
        <div style={{ minWidth: 150 }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              backgroundColor: "white"
            }}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="finance">Finance</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>User</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Email</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Role</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Department</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Designation</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Assigned Approver</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 600,
                        fontSize: 14
                      }}>
                        {getInitials(user.fullName)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{user.fullName}</div>
                        {user.phone && (
                          <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                            <Phone size={12} />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ fontSize: 14, color: "#374151", display: "flex", alignItems: "center", gap: 4 }}>
                      <Mail size={14} />
                      {user.email}
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={getRoleBadge(user.role)}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>
                    {user.department || "—"}
                  </td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>
                    {user.designation || "—"}
                  </td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>
                    {user.assignedApproverName || "—"}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={getStatusBadge(user.status)}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button
                        onClick={() => handleEdit(user)}
                        style={{
                          padding: "6px",
                          backgroundColor: "#f3f4f6",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center"
                        }}
                        title="Edit User"
                      >
                        <Edit size={16} color="#6b7280" />
                      </button>
                      <button
                        onClick={() => setShowDeactivateConfirm(user.id)}
                        style={{
                          padding: "6px",
                          backgroundColor: user.status === "active" ? "#fef3c7" : "#f3f4f6",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center"
                        }}
                        title={user.status === "active" ? "Deactivate User" : "Activate User"}
                      >
                        {user.status === "active" ? <UserX size={16} color="#d97706" /> : <UserCheck size={16} color="#6b7280" />}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(user.id)}
                        style={{
                          padding: "6px",
                          backgroundColor: "#fee2e2",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center"
                        }}
                        title="Delete User"
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <Users size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 8px 0" }}>No users found</h3>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            {searchTerm || roleFilter !== "all" ? "Try adjusting your search or filters." : "Get started by adding your first user."}
          </p>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showModal && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            width: "90%",
            maxWidth: 600,
            maxHeight: "90vh",
            overflow: "auto",
            padding: 24
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}>
                {editingUser ? "Edit User" : "Add New User"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "6px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer"
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={!!editingUser}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none",
                      backgroundColor: editingUser ? "#f9fafb" : "white"
                    }}
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                      Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "8px 36px 8px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          fontSize: 14,
                          outline: "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          backgroundColor: "transparent",
                          border: "none",
                          cursor: "pointer"
                        }}
                      >
                        {showPassword ? <EyeOff size={16} color="#6b7280" /> : <Eye size={16} color="#6b7280" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Assigned Approver
                  </label>
                  <select
                    value={formData.assignedApproverId}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignedApproverId: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  >
                    <option value="">None</option>
                    {approvers.map((approver) => (
                      <option key={approver.id} value={approver.id}>
                        {approver.fullName} ({approver.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Bank Details Section */}
              <div style={{ marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowBankDetails(!showBankDetails)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: 16
                  }}
                >
                  <CreditCard size={16} />
                  Bank Details {showBankDetails ? "▼" : "▶"}
                </button>

                {showBankDetails && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={formData.accountHolderName}
                        onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          fontSize: 14,
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          fontSize: 14,
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          fontSize: 14,
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={formData.ifscCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          fontSize: 14,
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: saving ? "#d1d5db" : "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: saving ? "not-allowed" : "pointer"
                  }}
                >
                  {saving ? "Saving..." : (editingUser ? "Update User" : "Create User")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: "90%"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <AlertCircle size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 4px 0" }}>
                  Delete User
                </h3>
                <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                  This cannot be undone. The user will be removed from the app.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateConfirm && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: "90%"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <AlertCircle size={24} color="#d97706" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 4px 0" }}>
                  {users.find(u => u.id === showDeactivateConfirm)?.status === "active" ? "Deactivate User" : "Activate User"}
                </h3>
                <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                  {users.find(u => u.id === showDeactivateConfirm)?.status === "active" 
                    ? "The user will not be able to access the app." 
                    : "The user will regain access to the app."}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setShowDeactivateConfirm(null)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleStatus(showDeactivateConfirm, users.find(u => u.id === showDeactivateConfirm)?.status || "")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: users.find(u => u.id === showDeactivateConfirm)?.status === "active" ? "#d97706" : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                {users.find(u => u.id === showDeactivateConfirm)?.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          backgroundColor: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          borderRadius: 8,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 1000
        }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </main>
  );
}
