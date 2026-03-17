"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { 
  Bell, 
  Calendar, 
  Clock, 
  DollarSign, 
  Settings, 
  Upload, 
  X, 
  Plus,
  CheckCircle,
  AlertCircle,
  Save,
  Shield,
  Receipt,
  Users,
  FileText,
  Lock,
  Tag,
  Building
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReminderRules {
  expenseSubmission: {
    enabled: boolean;
    frequency: "monthly" | "twice-monthly" | "weekly" | "biweekly";
    dayOfMonth?: number[];
    dayOfWeek?: string;
  };
  vendorPayment: {
    enabled: boolean;
    firstReminder: number;
    secondReminder: {
      enabled: boolean;
      days: number;
    };
  };
  approvalStuck: {
    enabled: boolean;
    triggerDays: number;
    repeatDays: number;
  };
  summaryReport: {
    enabled: boolean;
    frequency: "weekly" | "biweekly";
    dayOfWeek: string;
  };
}

interface ModuleAccess {
  expenses: {
    employee: boolean;
    manager: boolean;
    finance: boolean;
  };
  vendors: {
    employee: boolean;
    manager: boolean;
    finance: boolean;
  };
  budgets: {
    employee: boolean;
    manager: boolean;
    finance: boolean;
  };
  auditTrail: {
    employee: boolean;
    manager: boolean;
    finance: boolean;
  };
}

interface CompanySettings {
  name: string;
  financialYearStart: string;
  currency: string;
  logoURL?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Toast = ({ message, type }: { message: string; type: "success" | "error" }) => (
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

const SectionCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#10b981" }}>{icon}</span>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>{title}</h2>
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

const ToggleSwitch = ({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    style={{
      width: 44, height: 24, borderRadius: 12, backgroundColor: disabled ? "#e5e7eb" : checked ? "#10b981" : "#d1d5db",
      border: "none", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background-color 0.2s"
    }}
  >
    <div style={{
      width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", position: "absolute", top: 2, left: checked ? 22 : 2,
      transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
    }} />
  </button>
);

const TextInput = ({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" }}>
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14,
        width: "100%", boxSizing: "border-box", outline: "none"
      }}
      onFocus={e => e.currentTarget.style.borderColor = "#10b981"}
      onBlur={e => e.currentTarget.style.borderColor = "#e5e7eb"}
    />
  </div>
);

const NumberInput = ({ label, value, onChange, min = 1, max = 31 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" }}>
      {label}
    </label>
    <input
      type="number"
      value={value}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      min={min}
      max={max}
      style={{
        padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14,
        width: "100%", boxSizing: "border-box", outline: "none"
      }}
      onFocus={e => e.currentTarget.style.borderColor = "#10b981"}
      onBlur={e => e.currentTarget.style.borderColor = "#e5e7eb"}
    />
  </div>
);

const SelectInput = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{value: string; label: string}> }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" }}>
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14,
        width: "100%", boxSizing: "border-box", outline: "none", backgroundColor: "#fff"
      }}
      onFocus={e => e.currentTarget.style.borderColor = "#10b981"}
      onBlur={e => e.currentTarget.style.borderColor = "#e5e7eb"}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// ─── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // State for each section
  const [reminderRules, setReminderRules] = useState<ReminderRules>({
    expenseSubmission: {
      enabled: false,
      frequency: "monthly",
      dayOfMonth: [1],
      dayOfWeek: "Monday"
    },
    vendorPayment: {
      enabled: false,
      firstReminder: 7,
      secondReminder: {
        enabled: false,
        days: 2
      }
    },
    approvalStuck: {
      enabled: false,
      triggerDays: 2,
      repeatDays: 1
    },
    summaryReport: {
      enabled: false,
      frequency: "weekly",
      dayOfWeek: "Monday"
    }
  });

  const [moduleAccess, setModuleAccess] = useState<ModuleAccess>({
    expenses: { employee: true, manager: true, finance: true },
    vendors: { employee: false, manager: true, finance: true },
    budgets: { employee: false, manager: true, finance: true },
    auditTrail: { employee: false, manager: true, finance: true }
  });

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "",
    financialYearStart: "April",
    currency: "INR"
  });

  const [categories, setCategories] = useState<string[]>(["Travel", "Food", "Accommodation", "Office Supplies", "Medical", "Entertainment", "Training", "Petrol", "Other"]);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"reminder-rules" | "module-access" | "categories" | "company">("reminder-rules");

  // Load existing data on mount
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      try {
        // Load reminder rules
        const reminderDoc = await getDoc(doc(db, "reminderRules", "config"));
        if (reminderDoc.exists()) {
          setReminderRules(reminderDoc.data() as ReminderRules);
        }

        // Load module access
        const moduleDoc = await getDoc(doc(db, "appConfig", "moduleAccess"));
        if (moduleDoc.exists()) {
          setModuleAccess(moduleDoc.data() as ModuleAccess);
        } else {
          // Use default values if doc doesn't exist
          const defaultModuleAccess: ModuleAccess = {
            expenses: { employee: true, manager: true, finance: true },
            vendors: { employee: false, manager: true, finance: true },
            budgets: { employee: false, manager: true, finance: true },
            auditTrail: { employee: false, manager: true, finance: true }
          };
          setModuleAccess(defaultModuleAccess);
        }

        // Load company settings
        const companyDoc = await getDoc(doc(db, "appConfig", "company"));
        if (companyDoc.exists()) {
          setCompanySettings(companyDoc.data() as CompanySettings);
        }

        // Load expense categories
        const categoriesDoc = await getDoc(doc(db, "appConfig", "expenseCategories"));
        if (categoriesDoc.exists()) {
          setCategories(categoriesDoc.data().categories || []);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, [user]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Save handlers
  const saveReminderRules = async () => {
    try {
      await setDoc(doc(db, "reminderRules", "config"), reminderRules);
      showToast("Reminder rules saved successfully!", "success");
    } catch {
      showToast("Failed to save reminder rules.", "error");
    }
  };

  const saveModuleAccess = async () => {
    try {
      await setDoc(doc(db, "appConfig", "moduleAccess"), moduleAccess, { merge: true });
      showToast("Module access updated!", "success");
    } catch {
      showToast("Failed to save module access.", "error");
    }
  };

  const saveCompanySettings = async () => {
    try {
      await setDoc(doc(db, "appConfig", "company"), companySettings);
      showToast("Company settings saved successfully!", "success");
    } catch {
      showToast("Failed to save company settings.", "error");
    }
  };

  const saveExpenseCategories = async () => {
    try {
      await setDoc(doc(db, "appConfig", "expenseCategories"), { categories });
      showToast("Expense categories saved successfully!", "success");
    } catch {
      showToast("Failed to save expense categories.", "error");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const storageRef = ref(storage, `company/logo`);
      await uploadBytes(storageRef, file);
      const logoURL = await getDownloadURL(storageRef);
      
      setCompanySettings(prev => ({ ...prev, logoURL }));
      showToast("Logo uploaded successfully!", "success");
    } catch {
      showToast("Failed to upload logo.", "error");
    }
  };

  const addCategory = () => {
    const newCategory = prompt("Enter new category name:");
    if (newCategory && newCategory.trim()) {
      setCategories(prev => [...prev, newCategory.trim()]);
    }
  };

  const removeCategory = (category: string) => {
    if (categories.length <= 1) {
      showToast("Cannot delete the last category.", "error");
      return;
    }
    setCategories(prev => prev.filter(c => c !== category));
  };

  if (!user || user.role !== "admin") return null;

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Shield size={24} color="#10b981" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Admin Settings</h1>
      </div>

      {/* Tab Navigation */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e2e8f0",
        marginBottom: 24,
        borderRadius: 12,
        overflow: "hidden"
      }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          <button
            onClick={() => setActiveTab("reminder-rules")}
            style={{
              flex: 1,
              padding: "16px 20px",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: activeTab === "reminder-rules" ? "2px solid #f59e0b" : "2px solid transparent",
              color: activeTab === "reminder-rules" ? "#f59e0b" : "#64748b",
              fontSize: "14px",
              fontWeight: activeTab === "reminder-rules" ? "600" : "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "reminder-rules") {
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "reminder-rules") {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Bell size={16} />
            Reminder Rules
          </button>
          
          <button
            onClick={() => setActiveTab("module-access")}
            style={{
              flex: 1,
              padding: "16px 20px",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: activeTab === "module-access" ? "2px solid #f59e0b" : "2px solid transparent",
              color: activeTab === "module-access" ? "#f59e0b" : "#64748b",
              fontSize: "14px",
              fontWeight: activeTab === "module-access" ? "600" : "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "module-access") {
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "module-access") {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Shield size={16} />
            Module Access
          </button>
          
          <button
            onClick={() => setActiveTab("categories")}
            style={{
              flex: 1,
              padding: "16px 20px",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: activeTab === "categories" ? "2px solid #f59e0b" : "2px solid transparent",
              color: activeTab === "categories" ? "#f59e0b" : "#64748b",
              fontSize: "14px",
              fontWeight: activeTab === "categories" ? "600" : "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "categories") {
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "categories") {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Tag size={16} />
            Categories
          </button>
          
          <button
            onClick={() => setActiveTab("company")}
            style={{
              flex: 1,
              padding: "16px 20px",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: activeTab === "company" ? "2px solid #f59e0b" : "2px solid transparent",
              color: activeTab === "company" ? "#f59e0b" : "#64748b",
              fontSize: "14px",
              fontWeight: activeTab === "company" ? "600" : "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "company") {
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "company") {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Building size={16} />
            Company
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "reminder-rules" && (
        <div style={{ display: "grid", gap: 24 }}>
          
          {/* Expense Submission Reminder */}
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Expense Submission Reminder</h3>
              <ToggleSwitch checked={reminderRules.expenseSubmission.enabled} onChange={enabled => 
                setReminderRules(prev => ({ ...prev, expenseSubmission: { ...prev.expenseSubmission, enabled } }))
              } />
            </div>
            
            {reminderRules.expenseSubmission.enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <SelectInput
                  label="Frequency"
                  value={reminderRules.expenseSubmission.frequency}
                  onChange={frequency => setReminderRules(prev => ({ ...prev, expenseSubmission: { ...prev.expenseSubmission, frequency: frequency as "monthly" | "twice-monthly" | "weekly" | "biweekly" } }))}
                  options={[
                    { value: "monthly", label: "Once a month" },
                    { value: "twice-monthly", label: "Twice a month" },
                    { value: "weekly", label: "Weekly" },
                    { value: "biweekly", label: "Every two weeks" }
                  ]}
                />
                
                {reminderRules.expenseSubmission.frequency === "monthly" && (
                  <NumberInput
                    label="Day of month"
                    value={reminderRules.expenseSubmission.dayOfMonth?.[0] || 1}
                    onChange={day => setReminderRules(prev => ({ ...prev, expenseSubmission: { ...prev.expenseSubmission, dayOfMonth: [day as number] } }))}
                    min={1}
                    max={31}
                  />
                )}
                
                {reminderRules.expenseSubmission.frequency === "twice-monthly" && (
                  <>
                    <NumberInput
                      label="First day of month"
                      value={reminderRules.expenseSubmission.dayOfMonth?.[0] || 1}
                      onChange={day => setReminderRules(prev => ({ ...prev, expenseSubmission: { ...prev.expenseSubmission, dayOfMonth: [day as number, prev.expenseSubmission.dayOfMonth?.[1] || 15] } }))}
                      min={1}
                      max={31}
                    />
                    <NumberInput
                      label="Second day of month"
                      value={reminderRules.expenseSubmission.dayOfMonth?.[1] || 15}
                      onChange={day => setReminderRules(prev => ({ ...prev, expenseSubmission: { ...prev.expenseSubmission, dayOfMonth: [prev.expenseSubmission.dayOfMonth?.[0] || 1 as number, day as number] } }))}
                      min={1}
                      max={31}
                    />
                  </>
                )}
                
                {(reminderRules.expenseSubmission.frequency === "weekly" || reminderRules.expenseSubmission.frequency === "biweekly") && (
                  <SelectInput
                    label="Day of week"
                    value={reminderRules.expenseSubmission.dayOfWeek || "Monday"}
                    onChange={dayOfWeek => setReminderRules(prev => ({ ...prev, expenseSubmission: { ...prev.expenseSubmission, dayOfWeek: dayOfWeek as string } }))}
                    options={[
                      { value: "Monday", label: "Monday" },
                      { value: "Tuesday", label: "Tuesday" },
                      { value: "Wednesday", label: "Wednesday" },
                      { value: "Thursday", label: "Thursday" },
                      { value: "Friday", label: "Friday" },
                      { value: "Saturday", label: "Saturday" },
                      { value: "Sunday", label: "Sunday" }
                    ]}
                  />
                )}
              </div>
            )}
          </div>

          {/* Vendor Payment Due Reminder */}
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Vendor Payment Due Reminder</h3>
              <ToggleSwitch checked={reminderRules.vendorPayment.enabled} onChange={enabled => 
                setReminderRules(prev => ({ ...prev, vendorPayment: { ...prev.vendorPayment, enabled } }))
              } />
            </div>
            
            {reminderRules.vendorPayment.enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <NumberInput
                  label="First reminder (days before due)"
                  value={reminderRules.vendorPayment.firstReminder}
                  onChange={firstReminder => setReminderRules(prev => ({ ...prev, vendorPayment: { ...prev.vendorPayment, firstReminder: firstReminder as number } }))}
                  min={1}
                  max={30}
                />
                
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Second reminder
                    </label>
                    <ToggleSwitch checked={reminderRules.vendorPayment.secondReminder.enabled} onChange={enabled => 
                      setReminderRules(prev => ({ ...prev, vendorPayment: { 
                        ...prev.vendorPayment, 
                        secondReminder: { ...prev.vendorPayment.secondReminder, enabled } 
                      } }))
                    } />
                  </div>
                  {reminderRules.vendorPayment.secondReminder.enabled && (
                    <NumberInput
                      label="Days before due"
                      value={reminderRules.vendorPayment.secondReminder.days}
                      onChange={days => setReminderRules(prev => ({ ...prev, vendorPayment: { 
                        ...prev.vendorPayment, 
                        secondReminder: { ...prev.vendorPayment.secondReminder, days: days as number } 
                      } }))}
                      min={1}
                      max={30}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Approval Stuck Reminder */}
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Approval Stuck Reminder</h3>
              <ToggleSwitch checked={reminderRules.approvalStuck.enabled} onChange={enabled => 
                setReminderRules(prev => ({ ...prev, approvalStuck: { ...prev.approvalStuck, enabled } }))
              } />
            </div>
            
            {reminderRules.approvalStuck.enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <NumberInput
                  label="Trigger after X days pending"
                  value={reminderRules.approvalStuck.triggerDays}
                  onChange={triggerDays => setReminderRules(prev => ({ ...prev, approvalStuck: { ...prev.approvalStuck, triggerDays: triggerDays as number } }))}
                  min={1}
                  max={30}
                />
                <NumberInput
                  label="Repeat every Y days"
                  value={reminderRules.approvalStuck.repeatDays}
                  onChange={repeatDays => setReminderRules(prev => ({ ...prev, approvalStuck: { ...prev.approvalStuck, repeatDays: repeatDays as number } }))}
                  min={1}
                  max={30}
                />
              </div>
            )}
          </div>

          {/* Summary Report Reminder */}
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Summary Report Reminder</h3>
              <ToggleSwitch checked={reminderRules.summaryReport.enabled} onChange={enabled => 
                setReminderRules(prev => ({ ...prev, summaryReport: { ...prev.summaryReport, enabled } }))
              } />
            </div>
            
            {reminderRules.summaryReport.enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <SelectInput
                  label="Frequency"
                  value={reminderRules.summaryReport.frequency}
                  onChange={frequency => setReminderRules(prev => ({ ...prev, summaryReport: { ...prev.summaryReport, frequency: frequency as "weekly" | "biweekly" } }))}
                  options={[
                    { value: "weekly", label: "Weekly" },
                    { value: "biweekly", label: "Every two weeks" }
                  ]}
                />
                <SelectInput
                  label="Day of week"
                  value={reminderRules.summaryReport.dayOfWeek}
                  onChange={dayOfWeek => setReminderRules(prev => ({ ...prev, summaryReport: { ...prev.summaryReport, dayOfWeek: dayOfWeek as string } }))}
                  options={[
                    { value: "Monday", label: "Monday" },
                    { value: "Tuesday", label: "Tuesday" },
                    { value: "Wednesday", label: "Wednesday" },
                    { value: "Thursday", label: "Thursday" },
                    { value: "Friday", label: "Friday" },
                    { value: "Saturday", label: "Saturday" },
                    { value: "Sunday", label: "Sunday" }
                  ]}
                />
              </div>
            )}
          </div>

          <div style={{ textAlign: "right", marginTop: 24 }}>
            <button
              onClick={saveReminderRules}
              style={{
                padding: "8px 16px", backgroundColor: "#10b981", color: "#fff", borderRadius: 8, border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Save size={14} />
              Save Reminder Rules
            </button>
          </div>
        </div>
      )}

      {activeTab === "module-access" && (
        <div style={{
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          {/* Header Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr 1fr 1fr 1fr",
            backgroundColor: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            padding: "16px 20px"
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Module
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employee</span>
              <span style={{
                backgroundColor: "#f3f4f6",
                color: "#6b7280",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500
              }}>EMP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Manager</span>
              <span style={{
                backgroundColor: "#fed7aa",
                color: "#ea580c",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500
              }}>MGR</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Finance</span>
              <span style={{
                backgroundColor: "#dbeafe",
                color: "#1d4ed8",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500
              }}>FIN</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Admin</span>
              <span style={{
                backgroundColor: "#f3e8ff",
                color: "#7c3aed",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500
              }}>ADM</span>
            </div>
          </div>

          {/* Module Rows */}
          {[
            {
              key: 'expenses',
              name: 'Expenses',
              icon: <Receipt size={18} />,
              description: 'Submit and track expense claims'
            },
            {
              key: 'vendors',
              name: 'Vendors',
              icon: <Users size={18} />,
              description: 'Manage vendor and payable submissions'
            },
            {
              key: 'budgets',
              name: 'Budgets',
              icon: <DollarSign size={18} />,
              description: 'View and request budget allocations'
            },
            {
              key: 'auditTrail',
              name: 'Audit Trail',
              icon: <FileText size={18} />,
              description: 'View activity logs and audit history'
            }
          ].map((module, index) => {
            const access = moduleAccess[module.key as keyof ModuleAccess];
            const allAccess = access.employee && access.manager && access.finance;
            const someAccess = access.employee || access.manager || access.finance;
            const noAccess = !access.employee && !access.manager && !access.finance;
            
            return (
              <div key={module.key} style={{
                display: "grid",
                gridTemplateColumns: "320px 1fr 1fr 1fr 1fr",
                backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                borderBottom: "1px solid #f3f4f6",
                padding: "16px 20px",
                transition: "background-color 0.2s"
              }}>
                {/* Module Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280"
                  }}>
                    {module.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                        {module.name}
                      </div>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: allAccess ? "#10b981" : someAccess ? "#f59e0b" : "#ef4444"
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {module.description}
                    </div>
                  </div>
                </div>

                {/* Employee Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <label style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      style={{ display: "none" }}
                      checked={access.employee}
                      onChange={() => setModuleAccess(prev => ({
                        ...prev,
                        [module.key]: { ...prev[module.key as keyof ModuleAccess], employee: !prev[module.key as keyof ModuleAccess].employee }
                      }))}
                    />
                    <div style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: access.employee ? "#10b981" : "#e5e7eb",
                      position: "relative",
                      transition: "background-color 0.25s ease",
                      boxShadow: access.employee ? "0 0 0 3px #d1fae5" : "none"
                    }}>
                      <div style={{
                        position: "absolute",
                        top: 3,
                        left: access.employee ? 25 : 3,
                        width: 20,
                        height: 20,
                        backgroundColor: "white",
                        borderRadius: "50%",
                        transition: "left 0.25s ease",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                      }} />
                    </div>
                  </label>
                </div>

                {/* Manager Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <label style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      style={{ display: "none" }}
                      checked={access.manager}
                      onChange={() => setModuleAccess(prev => ({
                        ...prev,
                        [module.key]: { ...prev[module.key as keyof ModuleAccess], manager: !prev[module.key as keyof ModuleAccess].manager }
                      }))}
                    />
                    <div style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: access.manager ? "#10b981" : "#e5e7eb",
                      position: "relative",
                      transition: "background-color 0.25s ease",
                      boxShadow: access.manager ? "0 0 0 3px #d1fae5" : "none"
                    }}>
                      <div style={{
                        position: "absolute",
                        top: 3,
                        left: access.manager ? 25 : 3,
                        width: 20,
                        height: 20,
                        backgroundColor: "white",
                        borderRadius: "50%",
                        transition: "left 0.25s ease",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                      }} />
                    </div>
                  </label>
                </div>

                {/* Finance Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <label style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      style={{ display: "none" }}
                      checked={access.finance}
                      onChange={() => setModuleAccess(prev => ({
                        ...prev,
                        [module.key]: { ...prev[module.key as keyof ModuleAccess], finance: !prev[module.key as keyof ModuleAccess].finance }
                      }))}
                    />
                    <div style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: access.finance ? "#10b981" : "#e5e7eb",
                      position: "relative",
                      transition: "background-color 0.25s ease",
                      boxShadow: access.finance ? "0 0 0 3px #d1fae5" : "none"
                    }}>
                      <div style={{
                        position: "absolute",
                        top: 3,
                        left: access.finance ? 25 : 3,
                        width: 20,
                        height: 20,
                        backgroundColor: "white",
                        borderRadius: "50%",
                        transition: "left 0.25s ease",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                      }} />
                    </div>
                  </label>
                </div>

                {/* Admin Column (Always ON with lock) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    position: "relative",
                    opacity: 0.8,
                    cursor: "not-allowed"
                  }}>
                    <div style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: "#10b981",
                      position: "relative",
                      boxShadow: "0 0 0 3px #d1fae5"
                    }}>
                      <div style={{
                        position: "absolute",
                        top: 3,
                        left: 25,
                        width: 20,
                        height: 20,
                        backgroundColor: "white",
                        borderRadius: "50%",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                      }} />
                      <Lock size={10} style={{
                        position: "absolute",
                        top: 8,
                        right: 6,
                        color: "#6b7280",
                        opacity: 0.7
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "categories" && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1, marginBottom: 0 }}>
              <TextInput
                label="Add new category"
                value=""
                placeholder="Enter category name"
                onChange={() => {}}
              />
            </div>
            <button
              onClick={addCategory}
              style={{
                padding: "10px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: "24px"
              }}
            >
              <Plus size={16} />
              Add Category
            </button>
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((category, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "#374151"
                }}
              >
                {category}
                {categories.length > 1 && (
                  <button
                    onClick={() => removeCategory(category)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      cursor: "pointer",
                      padding: "2px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        
          <div style={{ textAlign: "right", marginTop: 24 }}>
            <button
              onClick={saveExpenseCategories}
              style={{
                padding: "8px 16px", backgroundColor: "#10b981", color: "#fff", borderRadius: 8, border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Save size={14} />
              Save Categories
            </button>
          </div>
        </div>
      )}

      {activeTab === "company" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          <TextInput
            label="Company Name"
            value={companySettings.name}
            onChange={name => setCompanySettings(prev => ({ ...prev, name }))}
            placeholder="Enter company name"
          />
          
          <SelectInput
            label="Financial Year Start Month"
            value={companySettings.financialYearStart}
            onChange={financialYearStart => setCompanySettings(prev => ({ ...prev, financialYearStart }))}
            options={[
              { value: "April", label: "April" },
              { value: "January", label: "January" },
              { value: "July", label: "July" },
              { value: "October", label: "October" }
            ]}
          />
          
          <SelectInput
            label="Currency"
            value={companySettings.currency}
            onChange={currency => setCompanySettings(prev => ({ ...prev, currency }))}
            options={[
              { value: "INR", label: "INR (₹)" },
              { value: "USD", label: "USD ($)" },
              { value: "EUR", label: "EUR (€)" },
              { value: "GBP", label: "GBP (£)" }
            ]}
          />
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </main>
  );
}
