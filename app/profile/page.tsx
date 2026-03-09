"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import {
  User, Mail, Phone, Building2, Briefcase, CreditCard,
  Lock, Camera, CheckCircle, AlertCircle, TrendingUp,
  Clock, XCircle, ChevronRight, Eye, EyeOff
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAmount: number;
}

interface RecentExpense {
  id: string;
  category: string;
  amount: number;
  date: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const statusStyle: Record<string, React.CSSProperties> = {
  pending: { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" },
  approved: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  rejected: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
};

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#10b981" }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1f2937", margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", disabled = false, placeholder = ""
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          padding: "9px 12px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          fontSize: 14,
          color: disabled ? "#9ca3af" : "#111827",
          backgroundColor: disabled ? "#f9fafb" : "#fff",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
        onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = "#10b981"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
      />
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      backgroundColor: type === "success" ? "#dcfce7" : "#fee2e2",
      color: type === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${type === "success" ? "#bbf7d0" : "#fecaca"}`,
      borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8,
      fontSize: 14, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      {type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Bank details state
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Stats
  const [stats, setStats] = useState<ExpenseStats>({ total: 0, pending: 0, approved: 0, rejected: 0, totalAmount: 0 });
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);

  // Photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Populate form from user
  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setPhone(user.phone ?? "");
    setDesignation(user.designation ?? "");
    setDepartment(user.department ?? "");
    setBankName(user.bankName ?? "");
    setAccountNumber(user.accountNumber ?? "");
    setIfscCode(user.ifscCode ?? "");
    setAccountHolderName(user.accountHolderName ?? "");
  }, [user]);

  // Load expense stats
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const q = query(collection(db, "expenses"), where("submittedBy", "==", user.uid), orderBy("date", "desc"));
      const snap = await getDocs(q);
      let pending = 0, approved = 0, rejected = 0, totalAmount = 0;
      const recent: RecentExpense[] = [];

      snap.forEach((doc, ) => {
        const d = doc.data();
        if (d.status === "pending") pending++;
        if (d.status === "approved") { approved++; totalAmount += d.amount ?? 0; }
        if (d.status === "rejected") rejected++;
        if (recent.length < 5) {
          recent.push({ id: doc.id, category: d.category ?? "Other", amount: d.amount ?? 0, date: d.date ?? "", status: d.status ?? "pending" });
        }
      });

      setStats({ total: snap.size, pending, approved, rejected, totalAmount });
      setRecentExpenses(recent);
    };
    fetchStats();
  }, [user]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `profile-photos/${user.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", user.uid), { photoURL });
      setUser({ ...user, photoURL });
      showToast("Photo updated!", "success");
    } catch {
      showToast("Failed to upload photo.", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { fullName, phone, designation, department });
      setUser({ ...user, fullName, phone, designation, department });
      showToast("Profile saved successfully!", "success");
    } catch {
      showToast("Failed to save profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBank = async () => {
    if (!user) return;
    setSavingBank(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { bankName, accountNumber, ifscCode, accountHolderName });
      setUser({ ...user, bankName, accountNumber, ifscCode, accountHolderName });
      showToast("Bank details saved!", "success");
    } catch {
      showToast("Failed to save bank details.", "error");
    } finally {
      setSavingBank(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !auth.currentUser) return;
    if (newPassword !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }
    if (newPassword.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }
    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showToast("Password changed successfully!", "success");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        showToast("Current password is incorrect.", "error");
      } else {
        showToast("Failed to change password.", "error");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  const initials = user.fullName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Profile Header ── */}
        <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "#ecfdf5", border: "3px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", backgroundColor: "#10b981", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <Camera size={12} color="#fff" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
          </div>

          {/* Name & role */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>{user.fullName}</h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 8px 0" }}>{user.email}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ backgroundColor: "#ecfdf5", color: "#065f46", padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              {user.department && (
                <span style={{ backgroundColor: "#f3f4f6", color: "#374151", padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
                  {user.department}
                </span>
              )}
              {user.designation && (
                <span style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
                  {user.designation}
                </span>
              )}
            </div>
          </div>

          {/* Approver info */}
          {user.assignedApproverName && (
            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Approver</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#065f46", margin: 0 }}>{user.assignedApproverName}</p>
            </div>
          )}
        </div>

        {/* ── Expense Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "Total Submitted", value: stats.total, icon: <TrendingUp size={18} color="#fff" />, accent: "#6366f1" },
            { label: "Pending", value: stats.pending, icon: <Clock size={18} color="#fff" />, accent: "#f59e0b" },
            { label: "Approved", value: stats.approved, icon: <CheckCircle size={18} color="#fff" />, accent: "#10b981" },
            { label: "Rejected", value: stats.rejected, icon: <XCircle size={18} color="#fff" />, accent: "#ef4444" },
            { label: "Total Reimbursed", value: formatINR(stats.totalAmount), icon: <CreditCard size={18} color="#fff" />, accent: "#0ea5e9" },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: s.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 2px 0", fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Personal Info ── */}
        <SectionCard title="Personal Information" icon={<User size={16} />}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <Field label="Full Name" value={fullName} onChange={setFullName} />
            <Field label="Email" value={user.email} disabled />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
            <Field label="Department" value={department} onChange={setDepartment} />
            <Field label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Senior Manager" />
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={{ padding: "9px 20px", backgroundColor: savingProfile ? "#a7f3d0" : "#10b981", color: "#fff", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: savingProfile ? "not-allowed" : "pointer" }}
            >
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </SectionCard>

        {/* ── Bank Details ── */}
        <SectionCard title="Bank Details for Reimbursement" icon={<CreditCard size={16} />}>
          <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
            ⚠️ Bank details are used for expense reimbursements only. Keep this information accurate.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <Field label="Account Holder Name" value={accountHolderName} onChange={setAccountHolderName} />
            <Field label="Bank Name" value={bankName} onChange={setBankName} placeholder="e.g. HDFC Bank" />
            <Field label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="e.g. 50100123456789" />
            <Field label="IFSC Code" value={ifscCode} onChange={setIfscCode} placeholder="e.g. HDFC0001234" />
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleSaveBank}
              disabled={savingBank}
              style={{ padding: "9px 20px", backgroundColor: savingBank ? "#a7f3d0" : "#10b981", color: "#fff", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: savingBank ? "not-allowed" : "pointer" }}
            >
              {savingBank ? "Saving…" : "Save Bank Details"}
            </button>
          </div>
        </SectionCard>

        {/* ── Recent Expenses ── */}
        {recentExpenses.length > 0 && (
          <SectionCard title="Recent Expense Submissions" icon={<Briefcase size={16} />}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  {["Category", "Amount", "Date", "Status"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((exp, i) => (
                  <tr key={exp.id} style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#fff" : "#fafafa")}
                  >
                    <td style={{ padding: "12px", fontSize: 14, color: "#374151" }}>{exp.category}</td>
                    <td style={{ padding: "12px", fontSize: 14, fontWeight: 600, color: "#111827" }}>{formatINR(exp.amount)}</td>
                    <td style={{ padding: "12px", fontSize: 14, color: "#6b7280" }}>
                      {exp.date ? new Date(exp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ ...statusStyle[exp.status], padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
                        {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}

        {/* ── Change Password ── */}
        <SectionCard title="Change Password" icon={<Lock size={16} />}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  style={{ padding: "9px 36px 9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, color: "#111827", width: "100%", boxSizing: "border-box", outline: "none" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
                />
                <button onClick={() => setShowPasswords(!showPasswords)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                  {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <Field label="New Password" value={newPassword} onChange={setNewPassword} type={showPasswords ? "text" : "password"} placeholder="Min. 6 characters" />
            <Field label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} type={showPasswords ? "text" : "password"} />
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              style={{ padding: "9px 20px", backgroundColor: (savingPassword || !currentPassword || !newPassword || !confirmPassword) ? "#d1d5db" : "#10b981", color: "#fff", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              {savingPassword ? "Updating…" : "Change Password"}
            </button>
          </div>
        </SectionCard>

      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </main>
  );
}