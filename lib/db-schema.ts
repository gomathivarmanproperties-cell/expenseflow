/**
 * Firestore database schema for ExpenseFlow.
 * Use these types when reading/writing documents.
 *
 * Security: Set custom claims (role, departmentId) via Admin SDK so
 * firestore.rules can enforce access. See firestore.rules and README.
 */

import type { Timestamp } from "firebase/firestore";

export type FirestoreTimestamp = Timestamp | Date;

// =============================================================================
// USERS
// =============================================================================
/** Collection: users */
export const USERS_COLLECTION = "users";

export type UserRole = "admin" | "finance" | "manager" | "employee";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string; // departmentId reference
  createdAt: FirestoreTimestamp;
}

// =============================================================================
// DEPARTMENTS
// =============================================================================
/** Collection: departments */
export const DEPARTMENTS_COLLECTION = "departments";

export interface Department {
  id: string;
  name: string;
  budgetAmount: number;
  createdAt: FirestoreTimestamp;
}

// =============================================================================
// EXPENSES
// =============================================================================
/** Collection: expenses */
export const EXPENSES_COLLECTION = "expenses";

export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface Expense {
  id: string;
  submittedBy: string; // userId
  departmentId: string;
  category: string;
  amount: number;
  date: FirestoreTimestamp;
  purpose: string;
  receiptUrl: string | null;
  status: ExpenseStatus;
  policyCompliant: boolean;
  flagReason: string | null;
  approvedBy: string | null; // userId
  createdAt: FirestoreTimestamp;
}

// =============================================================================
// VENDORS
// =============================================================================
/** Collection: vendors */
export const VENDORS_COLLECTION = "vendors";

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contactEmail: string;
  paymentTerms: string;
  bankDetails: string;
  active: boolean;
  createdAt: FirestoreTimestamp;
}

// =============================================================================
// INVOICES
// =============================================================================
/** Collection: invoices */
export const INVOICES_COLLECTION = "invoices";

export type InvoiceStatus = "pending" | "approved" | "paid" | "flagged";

export interface Invoice {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  amount: number;
  issueDate: FirestoreTimestamp;
  dueDate: FirestoreTimestamp;
  status: InvoiceStatus;
  duplicateFlag: boolean;
  flagReason: string | null;
  approvedBy: string | null;
  createdAt: FirestoreTimestamp;
}

// =============================================================================
// BUDGET PROPOSALS
// =============================================================================
/** Collection: budgetProposals */
export const BUDGET_PROPOSALS_COLLECTION = "budgetProposals";

export type BudgetProposalStatus = "pending" | "approved" | "rejected";

export interface BudgetProposal {
  id: string;
  departmentId: string;
  currentAmount: number;
  requestedAmount: number;
  reason: string;
  submittedBy: string;
  status: BudgetProposalStatus;
  reviewedBy: string | null;
  createdAt: FirestoreTimestamp;
}

// =============================================================================
// AUDIT LOGS
// =============================================================================
/** Collection: auditLogs */
export const AUDIT_LOGS_COLLECTION = "auditLogs";

export interface AuditLog {
  id: string;
  recordType: string; // e.g. "expense", "invoice", "budgetProposal"
  recordRef: string; // document path or id
  action: string; // e.g. "create", "approve", "reject"
  performedBy: string; // userId
  amount: number | null;
  createdAt: FirestoreTimestamp;
}
