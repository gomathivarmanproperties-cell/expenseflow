/**
 * Seed script for ExpenseFlow Firestore database.
 *
 * Prerequisites:
 * 1. Create a Firebase project and enable Firestore.
 * 2. Generate a service account key: Firebase Console → Project settings →
 *    Service accounts → Generate new private key. Save as e.g. scripts/serviceAccountKey.json.
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS to that file path, or set in .env.local:
 *    FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 * 4. Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed.ts
 *    Or: npx tsx scripts/seed.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as admin from "firebase-admin";

// Load .env.local from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error("Missing FIREBASE_ADMIN_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local");
  process.exit(1);
}

// Initialize Firebase Admin (use existing app if already initialized, e.g. in Next.js)
if (!admin.apps.length) {
  if (
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
          /\\n/g,
          "\n"
        ),
      }),
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();

function timestamp(d: Date = new Date()) {
  return admin.firestore.Timestamp.fromDate(d);
}

async function seed() {
  const batch = db.batch();
  const now = new Date();

  // -------------------------------------------------------------------------
  // Departments (create first; other collections reference these IDs)
  // -------------------------------------------------------------------------
  const deptEngineering = "dept_engineering";
  const deptMarketing = "dept_marketing";
  const deptOperations = "dept_operations";

  const departments = [
    { id: deptEngineering, name: "Engineering", budgetAmount: 500_000, createdAt: timestamp() },
    { id: deptMarketing, name: "Marketing", budgetAmount: 200_000, createdAt: timestamp() },
    { id: deptOperations, name: "Operations", budgetAmount: 150_000, createdAt: timestamp() },
  ];

  departments.forEach((d) => {
    const ref = db.collection("departments").doc(d.id);
    batch.set(ref, { ...d, id: d.id });
  });

  // -------------------------------------------------------------------------
  // Users (use placeholder IDs; in production these are Firebase Auth UIDs)
  // -------------------------------------------------------------------------
  const userAdmin = "user_admin";
  const userFinance = "user_finance";
  const userManagerEng = "user_manager_eng";
  const userManagerMkt = "user_manager_mkt";
  const userEmp1 = "user_emp_1";
  const userEmp2 = "user_emp_2";

  const users = [
    { id: userAdmin, email: "admin@expenseflow.demo", fullName: "Admin User", role: "admin", department: deptEngineering, createdAt: timestamp() },
    { id: userFinance, email: "finance@expenseflow.demo", fullName: "Finance User", role: "finance", department: deptOperations, createdAt: timestamp() },
    { id: userManagerEng, email: "eng.manager@expenseflow.demo", fullName: "Engineering Manager", role: "manager", department: deptEngineering, createdAt: timestamp() },
    { id: userManagerMkt, email: "mkt.manager@expenseflow.demo", fullName: "Marketing Manager", role: "manager", department: deptMarketing, createdAt: timestamp() },
    { id: userEmp1, email: "alice@expenseflow.demo", fullName: "Alice Dev", role: "employee", department: deptEngineering, createdAt: timestamp() },
    { id: userEmp2, email: "bob@expenseflow.demo", fullName: "Bob Designer", role: "employee", department: deptMarketing, createdAt: timestamp() },
  ];

  users.forEach((u) => {
    const ref = db.collection("users").doc(u.id);
    batch.set(ref, { ...u, id: u.id });
  });

  // -------------------------------------------------------------------------
  // Vendors
  // -------------------------------------------------------------------------
  const vendorAws = "vendor_aws";
  const vendorFigma = "vendor_figma";
  const vendorNotion = "vendor_notion";

  const vendors = [
    { id: vendorAws, name: "AWS", category: "Cloud", contactEmail: "billing@aws.amazon.com", paymentTerms: "Net 30", bankDetails: "****1234", active: true, createdAt: timestamp() },
    { id: vendorFigma, name: "Figma", category: "SaaS", contactEmail: "billing@figma.com", paymentTerms: "Net 15", bankDetails: "****5678", active: true, createdAt: timestamp() },
    { id: vendorNotion, name: "Notion", category: "SaaS", contactEmail: "billing@notion.so", paymentTerms: "Net 30", bankDetails: "****9012", active: true, createdAt: timestamp() },
  ];

  vendors.forEach((v) => {
    const ref = db.collection("vendors").doc(v.id);
    batch.set(ref, { ...v, id: v.id });
  });

  // -------------------------------------------------------------------------
  // Expenses
  // -------------------------------------------------------------------------
  const expenses = [
    { id: "exp_1", submittedBy: userEmp1, departmentId: deptEngineering, category: "Software", amount: 1200, date: timestamp(new Date(now.getFullYear(), now.getMonth(), 1)), purpose: "IDE licenses", receiptUrl: null, status: "approved", policyCompliant: true, flagReason: null, approvedBy: userManagerEng, createdAt: timestamp() },
    { id: "exp_2", submittedBy: userEmp2, departmentId: deptMarketing, category: "Design", amount: 450, date: timestamp(new Date(now.getFullYear(), now.getMonth(), 5)), purpose: "Stock assets", receiptUrl: null, status: "pending", policyCompliant: true, flagReason: null, approvedBy: null, createdAt: timestamp() },
    { id: "exp_3", submittedBy: userEmp1, departmentId: deptEngineering, category: "Cloud", amount: 3200, date: timestamp(new Date(now.getFullYear(), now.getMonth() - 1, 15)), purpose: "Hosting Q1", receiptUrl: null, status: "approved", policyCompliant: true, flagReason: null, approvedBy: userFinance, createdAt: timestamp() },
  ];

  expenses.forEach((e) => {
    const ref = db.collection("expenses").doc(e.id);
    batch.set(ref, { ...e, id: e.id });
  });

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------
  const invoices = [
    { id: "inv_1", vendorId: vendorAws, invoiceNumber: "AWS-2024-001", amount: 8500, issueDate: timestamp(new Date(now.getFullYear(), now.getMonth(), 1)), dueDate: timestamp(new Date(now.getFullYear(), now.getMonth(), 31)), status: "approved", duplicateFlag: false, flagReason: null, approvedBy: userFinance, createdAt: timestamp() },
    { id: "inv_2", vendorId: vendorFigma, invoiceNumber: "FIG-2024-002", amount: 640, issueDate: timestamp(new Date(now.getFullYear(), now.getMonth(), 5)), dueDate: timestamp(new Date(now.getFullYear(), now.getMonth(), 20)), status: "pending", duplicateFlag: false, flagReason: null, approvedBy: null, createdAt: timestamp() },
  ];

  invoices.forEach((i) => {
    const ref = db.collection("invoices").doc(i.id);
    batch.set(ref, { ...i, id: i.id });
  });

  // -------------------------------------------------------------------------
  // Budget proposals
  // -------------------------------------------------------------------------
  const budgetProposals = [
    { id: "bp_1", departmentId: deptEngineering, currentAmount: 500_000, requestedAmount: 550_000, reason: "New hires Q3", submittedBy: userManagerEng, status: "pending", reviewedBy: null, createdAt: timestamp() },
    { id: "bp_2", departmentId: deptMarketing, currentAmount: 200_000, requestedAmount: 220_000, reason: "Campaign boost", submittedBy: userManagerMkt, status: "approved", reviewedBy: userFinance, createdAt: timestamp() },
  ];

  budgetProposals.forEach((b) => {
    const ref = db.collection("budgetProposals").doc(b.id);
    batch.set(ref, { ...b, id: b.id });
  });

  // -------------------------------------------------------------------------
  // Audit logs
  // -------------------------------------------------------------------------
  const auditLogs = [
    { id: "log_1", recordType: "expense", recordRef: "expenses/exp_1", action: "approve", performedBy: userManagerEng, amount: 1200, createdAt: timestamp() },
    { id: "log_2", recordType: "invoice", recordRef: "invoices/inv_1", action: "approve", performedBy: userFinance, amount: 8500, createdAt: timestamp() },
    { id: "log_3", recordType: "budgetProposal", recordRef: "budgetProposals/bp_2", action: "approve", performedBy: userFinance, amount: 220_000, createdAt: timestamp() },
  ];

  auditLogs.forEach((a) => {
    const ref = db.collection("auditLogs").doc(a.id);
    batch.set(ref, { ...a, id: a.id });
  });

  await batch.commit();
  console.log("Seed completed: departments, users, vendors, expenses, invoices, budgetProposals, auditLogs.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
