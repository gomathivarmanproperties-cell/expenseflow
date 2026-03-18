"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  collection, query, where, getDocs, addDoc,
  serverTimestamp, doc, getDoc
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  Receipt, Wallet, Upload, X, AlertCircle,
  CheckCircle, ArrowLeft, Plus, Trash2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface TeamMember {
  userId: string;
  name: string;
  amount: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label, required, children
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.05em"
      }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px", border: "1px solid #e2e8f0",
  borderRadius: 8, fontSize: 14, color: "#0f172a",
  backgroundColor: "#fff", outline: "none", width: "100%",
  boxSizing: "border-box"
};

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function NewExpensePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [type, setType] = useState<"reimbursement" | "petty_cash_advance">("reimbursement");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [notes, setNotes] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [expectedUseDate, setExpectedUseDate] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [isForTeam, setIsForTeam] = useState(false);
  const [teamDistribution, setTeamDistribution] = useState<TeamMember[]>([]);

  // Data
  const [categories, setCategories] = useState<string[]>([
    "Travel", "Food", "Accommodation", "Office Supplies",
    "Medical", "Entertainment", "Training", "Petrol", "Other"
  ]);
  const [projects, setProjects] = useState<Project[]>([]);

  // File upload
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Check approver
  const hasApprover = !!(user?.assignedApproverId || user?.tempApproverId);
  const today = new Date();
  const tempValid = user?.tempApproverId && user?.tempApproverFrom && user?.tempApproverUntil &&
    today >= new Date(user.tempApproverFrom) && today <= new Date(user.tempApproverUntil);
  const effectiveApproverId = tempValid ? user?.tempApproverId : user?.assignedApproverId;
  const effectiveApproverName = tempValid ? user?.tempApproverName : user?.assignedApproverName;

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const snap = await getDoc(doc(db, "appConfig", "expenseCategories"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.categories?.length) setCategories(data.categories);
        }
      } catch { /* use defaults */ }
    };
    loadCategories();
  }, []);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const q = query(collection(db, "projects"), where("status", "==", "Active"));
        const snap = await getDocs(q);
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      } catch { /* ignore */ }
    };
    loadProjects();
  }, []);

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Team distribution
  const addTeamMember = () => {
    setTeamDistribution(prev => [...prev, { userId: "", name: "", amount: "" }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamDistribution(prev => prev.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    setTeamDistribution(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const teamTotal = teamDistribution.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  const amountNum = parseFloat(amount) || 0;
  const teamMismatch = isForTeam && teamDistribution.length > 0 && Math.abs(teamTotal - amountNum) > 0.01;

  const userName = user.fullName || user.email?.split("@")[0] || "User";

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title || !category || !amount || !date) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    if (teamMismatch) {
      showToast("Team distribution total must equal requested amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      let receiptURL = null;
      let receiptName = null;

      // Upload file if provided
      if (file) {
        setUploading(true);
        const storageRef = ref(storage, `receipts/${user.uid}/${Date.now()}_${file.name}`);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on("state_changed",
            snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => {
              receiptURL = await getDownloadURL(task.snapshot.ref);
              receiptName = file.name;
              resolve();
            }
          );
        });
        setUploading(false);
      }

      // Save expense
      const expenseData = {
        title,
        type,
        category,
        amount: parseFloat(amount),
        date,
        projectId: projectId || null,
        projectName: projectName || null,
        department,
        paidTo: paidTo || null,
        notes: notes || null,
        receiptURL,
        receiptName,
        submittedBy: user.uid,
        submittedByName: userName,
        submittedByEmail: user.email,
        assignedApproverId: effectiveApproverId ?? null,
        assignedApproverName: effectiveApproverName ?? null,
        status: saveAsDraft ? "draft" : "pending_manager",
        expectedUseDate: expectedUseDate || null,
        expectedReturnDate: expectedReturnDate || null,
        isForTeam,
        teamDistribution: isForTeam ? teamDistribution : [],
        approvalHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, "expenses"), expenseData);

      if (!saveAsDraft) {
        // Notify approver only if not saving as draft
        if (effectiveApproverId) {
          await addDoc(collection(db, "notifications"), {
            userId: effectiveApproverId,
            title: "New Expense Submitted",
            message: `${user.fullName} submitted ₹${amount} for ${category}`,
            type: "info",
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      showToast(
        saveAsDraft ? "Expense saved as draft!" : "Expense submitted successfully!", 
        "success"
      );
      router.push("/expenses");
    } catch (err) {
      console.error(err);
      showToast("Failed to submit. Please try again.", "error");
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: "#64748b", fontSize: 13, marginBottom: 20, padding: 0
        }}
      >
        <ArrowLeft size={15} /> Back to Expenses
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>
        New Submission
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px 0" }}>
        Submit an expense reimbursement or petty cash advance request
      </p>

      {/* No approver warning */}
      {!hasApprover && (
        <div style={{
          backgroundColor: "#fffbeb", 
          border: "1px solid #fde68a",
          borderRadius: 10, padding: "10px 14px", 
          marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8
        }}>
          <AlertCircle size={16} color="#d97706" />
          <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>
            No approver assigned yet. You can still save drafts, 
            but ask your Admin to assign an approver before 
            submitting a report.
          </p>
        </div>
      )}

      {/* Temporary approver notice */}
      {tempValid && user?.tempApproverName && (
        <div style={{
          backgroundColor: "#fffbeb", 
          border: "1px solid #fde68a",
          borderRadius: 10, padding: "10px 14px", 
          marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8
        }}>
          <AlertCircle size={18} color="#d97706" />
          <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>
            Your temporary approver <strong>{user.tempApproverName}</strong> will review this
            submission (valid until {user.tempApproverUntil}).
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Type Selector */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" }}>
            Submission Type <span style={{ color: "#ef4444" }}>*</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              {
                value: "reimbursement" as const,
                icon: <Receipt size={22} />,
                label: "Expense Reimbursement",
                desc: "I paid from my own pocket"
              },
              {
                value: "petty_cash_advance" as const,
                icon: <Wallet size={22} />,
                label: "Petty Cash Advance",
                desc: "I need cash upfront before spending"
              }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                style={{
                  padding: 16, borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: type === opt.value ? "2px solid #10b981" : "2px solid #e2e8f0",
                  backgroundColor: type === opt.value ? "#f0fdf4" : "#fff",
                  transition: "all 0.15s"
                }}
              >
                <div style={{ color: type === opt.value ? "#10b981" : "#94a3b8", marginBottom: 8 }}>
                  {opt.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Expense Details */}
        <div style={{
          backgroundColor: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 14, padding: 20, marginBottom: 16
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 16px 0" }}>
            Expense Details
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Title / Purpose" required>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Client meeting lunch"
                  required
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                />
              </Field>
            </div>

            <Field label="Category" required>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Amount (₹)" required>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                required
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
              />
            </Field>

            <Field label="Date" required>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={type === "reimbursement" ? new Date().toISOString().split("T")[0] : undefined}
                min={type === "petty_cash_advance" ? new Date().toISOString().split("T")[0] : undefined}
                required
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
              />
            </Field>

            <Field label="Project (Optional)">
              <select
                value={projectId}
                onChange={e => {
                  setProjectId(e.target.value);
                  const p = projects.find(p => p.id === e.target.value);
                  setProjectName(p ? `${p.name} (${p.code})` : "");
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">No Project (General)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </Field>

            <Field label="Department">
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
              />
            </Field>

            {type === "reimbursement" && (
              <Field label="Paid To / Merchant (Optional)">
                <input
                  type="text"
                  value={paidTo}
                  onChange={e => setPaidTo(e.target.value)}
                  placeholder="e.g. Swiggy, Uber"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                />
              </Field>
            )}

            {type === "petty_cash_advance" && (
              <>
                <Field label="Expected Use Date (Optional)">
                  <input
                    type="date"
                    value={expectedUseDate}
                    onChange={e => setExpectedUseDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Expected Return Date (Optional)">
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={e => setExpectedReturnDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </>
            )}

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Notes / Remarks (Optional)">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional details..."
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Team Distribution (Petty Cash only) */}
        {type === "petty_cash_advance" && (
          <div style={{
            backgroundColor: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 14, padding: 20, marginBottom: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                Team Distribution (Optional)
              </h3>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Distribute to team?</span>
                <input
                  type="checkbox"
                  checked={isForTeam}
                  onChange={e => setIsForTeam(e.target.checked)}
                />
              </label>
            </div>

            {isForTeam && (
              <>
                {teamDistribution.map((member, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 140px 40px", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={member.name}
                      onChange={e => updateTeamMember(index, "name", e.target.value)}
                      placeholder="Team member name"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      value={member.amount}
                      onChange={e => updateTeamMember(index, "amount", e.target.value)}
                      placeholder="Amount ₹"
                      min="0"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeTeamMember(index)}
                      style={{ padding: 8, backgroundColor: "#fee2e2", border: "none", borderRadius: 8, cursor: "pointer" }}
                    >
                      <Trash2 size={14} color="#dc2626" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addTeamMember}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0", borderRadius: 8,
                    color: "#16a34a", fontSize: 13, cursor: "pointer", marginTop: 8
                  }}
                >
                  <Plus size={14} /> Add Member
                </button>

                {teamDistribution.length > 0 && (
                  <div style={{
                    marginTop: 12, padding: "8px 12px",
                    backgroundColor: teamMismatch ? "#fef2f2" : "#f0fdf4",
                    borderRadius: 8, fontSize: 13,
                    color: teamMismatch ? "#991b1b" : "#166534"
                  }}>
                    Team total: ₹{teamTotal.toLocaleString("en-IN")} / ₹{amountNum.toLocaleString("en-IN")} requested
                    {teamMismatch && " — totals must match"}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Receipt Upload */}
        <div style={{
          backgroundColor: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 14, padding: 20, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 16px 0" }}>
            Receipt / Document {type === "reimbursement" ? "(Recommended)" : "(Optional)"}
          </h3>

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #cbd5e1", borderRadius: 10,
                padding: 32, textAlign: "center", cursor: "pointer",
                transition: "all 0.15s"
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "#10b981";
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f0fdf4";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "#cbd5e1";
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
              }}
            >
              <Upload size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 4px 0" }}>
                Click to upload receipt
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                PNG, JPG, PDF up to 10MB
              </p>
            </div>
          ) : (
            <div style={{
              border: "1px solid #e2e8f0", borderRadius: 10,
              padding: 16, display: "flex", alignItems: "center", gap: 12
            }}>
              {filePreview ? (
                <img src={filePreview} alt="Receipt" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6 }} />
              ) : (
                <div style={{ width: 60, height: 60, backgroundColor: "#f1f5f9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Receipt size={24} color="#64748b" />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: "0 0 2px 0" }}>
                  {file.name}
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                {uploading && (
                  <div style={{ marginTop: 6, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2 }}>
                    <div style={{ height: 4, backgroundColor: "#10b981", borderRadius: 2, width: `${uploadProgress}%`, transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                style={{ padding: 6, backgroundColor: "#fee2e2", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                <X size={14} color="#dc2626" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => router.push("/expense-reports")}
            style={{
              padding: "12px 24px", backgroundColor: "#f1f5f9",
              color: "#374151", border: "1px solid #e2e8f0",
              borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setSaveAsDraft(true);
              // Trigger form submission
              const form = document.querySelector("form");
              if (form) form.requestSubmit();
            }}
            disabled={submitting}
            style={{
              padding: "12px 24px", backgroundColor: "#64748b",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="submit"
            disabled={submitting || teamMismatch}
            style={{
              padding: "12px 28px",
              backgroundColor: (submitting || teamMismatch) ? "#d1fae5" : "#10b981",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: (submitting || teamMismatch) ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>

      </form>

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