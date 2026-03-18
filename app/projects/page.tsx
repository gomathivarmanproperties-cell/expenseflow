"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  FolderOpen, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  Building,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  PauseCircle,
  XCircle,
  X,
  Briefcase
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

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Redirect non-authorized users
  useEffect(() => {
    if (user && !["admin", "manager", "finance"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    clientName: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "active" as "active" | "on-hold" | "closed",
    totalBudget: 0,
    expensesBudget: 0,
    vendorsBudget: 0,
    pettyCashBudget: 0,
    purchaseOrdersBudget: 0,
    teamMembers: [] as string[]
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load projects
  useEffect(() => {
    if (!user || !["admin", "manager", "finance"].includes(user.role)) return;

    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData: Project[] = [];
      snapshot.forEach((doc) => {
        projectsData.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(projectsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Load available users for team members
  useEffect(() => {
    if (!user || !["admin", "manager", "finance"].includes(user.role)) return;

    const q = query(collection(db, "users"), where("status", "==", "active"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setAvailableUsers(usersData);
    });

    return unsubscribe;
  }, [user]);

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.clientName && project.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !["admin", "manager", "finance"].includes(user.role)) return;

    // Validate budget lines don't exceed total
    const totalBudgetLines = formData.expensesBudget + formData.vendorsBudget + 
                           formData.pettyCashBudget + formData.purchaseOrdersBudget;
    
    if (totalBudgetLines > formData.totalBudget) {
      showToast("Budget lines cannot exceed total budget.", "error");
      return;
    }

    setSaving(true);
    try {
      const projectData = {
        name: formData.name,
        code: formData.code,
        clientName: formData.clientName,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        totalBudget: formData.totalBudget,
        budgetLines: {
          expenses: formData.expensesBudget,
          vendors: formData.vendorsBudget,
          pettyCash: formData.pettyCashBudget,
          purchaseOrders: formData.purchaseOrdersBudget
        },
        spent: {
          expenses: 0,
          vendors: 0,
          pettyCash: 0,
          po: 0
        },
        teamMembers: formData.teamMembers.map(userId => {
          const user = availableUsers.find(u => u.id === userId);
          return {
            userId,
            fullName: user?.fullName || "",
            role: user?.role || "",
            department: user?.department || ""
          };
        }),
        createdBy: user.uid,
        createdByName: user.fullName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingProject) {
        // Update existing project
        await updateDoc(doc(db, "projects", editingProject.id), projectData);
        showToast("Project updated successfully!", "success");
      } else {
        // Create new project
        await setDoc(doc(db, "projects", formData.code), projectData);
        showToast("Project created successfully!", "success");
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving project:", error);
      showToast(editingProject ? "Failed to update project." : "Failed to create project.", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      clientName: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "active",
      totalBudget: 0,
      expensesBudget: 0,
      vendorsBudget: 0,
      pettyCashBudget: 0,
      purchaseOrdersBudget: 0,
      teamMembers: []
    });
    setEditingProject(null);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      code: project.code,
      clientName: project.clientName || "",
      description: project.description || "",
      startDate: project.startDate || "",
      endDate: project.endDate || "",
      status: project.status,
      totalBudget: project.totalBudget,
      expensesBudget: project.budgetLines.expenses,
      vendorsBudget: project.budgetLines.vendors,
      pettyCashBudget: project.budgetLines.pettyCash,
      purchaseOrdersBudget: project.budgetLines.purchaseOrders,
      teamMembers: project.teamMembers.map(m => m.userId)
    });
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
      "on-hold": { backgroundColor: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" },
      closed: { backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }
    };
    const icons = {
      active: <CheckCircle size={12} />,
      "on-hold": <PauseCircle size={12} />,
      closed: <XCircle size={12} />
    };
    return {
      ...styles[status as keyof typeof styles],
      padding: "4px 8px",
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 4
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

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!user || !["admin", "manager", "finance"].includes(user.role)) {
    return null;
  }

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 8px 0" }}>Projects</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Manage project budgets and track expenses</p>
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
          New Project
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <div style={{ position: "relative" }}>
            <Search size={20} style={{ position: "absolute", left: 12, top: 12, color: "#6b7280" }} />
            <input
              type="text"
              placeholder="Search projects..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
        {filteredProjects.map((project) => {
          const totalSpent = project.spent.expenses + project.spent.vendors + 
                           project.spent.pettyCash + project.spent.po;
          const progress = calculateProgress(totalSpent, project.totalBudget);
          
          return (
            <div
              key={project.id}
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                transition: "all 0.2s",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 4px 0" }}>
                    {project.name}
                  </h3>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 8px 0" }}>
                    {project.code}
                  </p>
                  {project.clientName && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Building size={14} color="#6b7280" />
                      <span style={{ fontSize: 13, color: "#374151" }}>{project.clientName}</span>
                    </div>
                  )}
                </div>
                <div style={getStatusBadge(project.status)}>
                  {project.status === "active" && <CheckCircle size={12} />}
                  {project.status === "on-hold" && <PauseCircle size={12} />}
                  {project.status === "closed" && <XCircle size={12} />}
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace("-", " ")}
                </div>
              </div>

              {/* Budget Progress */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Budget Used</span>
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                    {formatINR(totalSpent)} / {formatINR(project.totalBudget)}
                  </span>
                </div>
                <div style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "#f3f4f6",
                  borderRadius: 4,
                  overflow: "hidden"
                }}>
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      backgroundColor: getProgressBarColor(progress),
                      transition: "width 0.3s ease"
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  {progress.toFixed(1)}% of budget used
                </div>
              </div>

              {/* Team Members */}
              {project.teamMembers.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Users size={14} color="#6b7280" />
                    <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
                      Team ({project.teamMembers.length})
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {project.teamMembers.slice(0, 4).map((member, index) => (
                      <div
                        key={member.userId}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: "#10b981",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 600,
                          border: index === 0 ? "2px solid #f59e0b" : "none"
                        }}
                        title={member.fullName}
                      >
                        {member.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                    ))}
                    {project.teamMembers.length > 4 && (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#6b7280",
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      >
                        +{project.teamMembers.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Created by {project.createdByName}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {new Date(project.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 80, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <FolderOpen size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 8px 0" }}>No projects found</h3>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px 0" }}>
            {searchTerm || statusFilter !== "all" ? "Try adjusting your search or filters." : "Get started by creating your first project."}
          </p>
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
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      )}

      {/* Add/Edit Project Modal */}
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
            maxWidth: 700,
            maxHeight: "90vh",
            overflow: "auto",
            padding: 24
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}>
                {editingProject ? "Edit Project" : "Create New Project"}
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
              {/* Basic Information */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 16px 0" }}>Basic Information</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                      Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                      Project Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. PROJ-001"
                      disabled={!!editingProject}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: editingProject ? "#f9fafb" : "white"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
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
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as "active" | "on-hold" | "closed" }))}
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
                      <option value="on-hold">On Hold</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        resize: "vertical"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
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
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
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
              </div>

              {/* Budget */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 16px 0" }}>Budget</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>
                      Total Budget (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.totalBudget}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalBudget: Number(e.target.value) }))}
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
                      Expense Budget (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.expensesBudget}
                      onChange={(e) => setFormData(prev => ({ ...prev, expensesBudget: Number(e.target.value) }))}
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
                      Vendor/Payables Budget (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.vendorsBudget}
                      onChange={(e) => setFormData(prev => ({ ...prev, vendorsBudget: Number(e.target.value) }))}
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
                      Petty Cash Budget (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.pettyCashBudget}
                      onChange={(e) => setFormData(prev => ({ ...prev, pettyCashBudget: Number(e.target.value) }))}
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
                      Purchase Orders Budget (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.purchaseOrdersBudget}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchaseOrdersBudget: Number(e.target.value) }))}
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
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 20 }}>
                      Total allocated: {formatINR(formData.expensesBudget + formData.vendorsBudget + formData.pettyCashBudget + formData.purchaseOrdersBudget)}
                    </div>
                    {(formData.expensesBudget + formData.vendorsBudget + formData.pettyCashBudget + formData.purchaseOrdersBudget) > formData.totalBudget && (
                      <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                        ⚠️ Budget lines exceed total budget
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Team Members */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 16px 0" }}>Team Members</h3>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {formData.teamMembers.map(userId => {
                      const user = availableUsers.find(u => u.id === userId);
                      return user ? (
                        <div
                          key={userId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            backgroundColor: "#f3f4f6",
                            borderRadius: 20,
                            fontSize: 13
                          }}
                        >
                          <span>{user.fullName}</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ 
                              ...prev, 
                              teamMembers: prev.teamMembers.filter(id => id !== userId) 
                            }))}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 2,
                              borderRadius: 4
                            }}
                          >
                            <X size={12} color="#6b7280" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !formData.teamMembers.includes(e.target.value)) {
                        setFormData(prev => ({
                          ...prev,
                          teamMembers: [...prev.teamMembers, e.target.value]
                        }));
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none"
                    }}
                  >
                    <option value="">Add team member...</option>
                    {availableUsers
                      .filter(user => !formData.teamMembers.includes(user.id))
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.role}) - {user.department}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
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
                  {saving ? "Saving..." : (editingProject ? "Update Project" : "Create Project")}
                </button>
              </div>
            </form>
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
          <CheckCircle size={16} />
          {toast.message}
        </div>
      )}
    </main>
  );
}
