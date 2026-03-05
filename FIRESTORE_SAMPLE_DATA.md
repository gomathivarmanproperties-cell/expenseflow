# Firestore Sample Data for Testing

This document contains sample Firestore documents you can manually add to test the Budgets and Audit Trail pages.

## 📋 **Budget Proposals Collection (`budgetProposals`)**

Add these documents to the `budgetProposals` collection:

### 1. Pending Budget Increase Request
```json
{
  "departmentId": "dept_engineering",
  "departmentName": "Engineering",
  "requestedAmount": 150000,
  "currentAmount": 120000,
  "reason": "Need additional budget for new cloud infrastructure and developer tools to support Q4 product launches",
  "status": "pending",
  "requestedBy": "Sarah Johnson",
  "requestedAt": "2024-03-15T10:30:00.000Z"
}
```

### 2. Pending Budget Decrease Request
```json
{
  "departmentId": "dept_marketing",
  "departmentName": "Marketing",
  "requestedAmount": 80000,
  "currentAmount": 100000,
  "reason": "Reducing budget due to completed campaign and reallocating funds to high-priority projects",
  "status": "pending",
  "requestedBy": "Mike Chen",
  "requestedAt": "2024-03-14T14:20:00.000Z"
}
```

### 3. Approved Budget Request
```json
{
  "departmentId": "dept_sales",
  "departmentName": "Sales",
  "requestedAmount": 200000,
  "currentAmount": 150000,
  "reason": "Expansion of sales team and travel budget for new market penetration",
  "status": "approved",
  "requestedBy": "Emily Davis",
  "requestedAt": "2024-03-10T09:15:00.000Z",
  "reviewedAt": "2024-03-11T16:45:00.000Z",
  "reviewedBy": "Admin User",
  "reviewComment": "Approved based on Q1 performance metrics and market analysis"
}
```

### 4. Rejected Budget Request
```json
{
  "departmentId": "dept_hr",
  "departmentName": "Human Resources",
  "requestedAmount": 120000,
  "currentAmount": 90000,
  "reason": "Additional budget for employee training programs and HR software upgrades",
  "status": "rejected",
  "requestedBy": "Lisa Wang",
  "requestedAt": "2024-03-08T11:30:00.000Z",
  "reviewedAt": "2024-03-09T13:20:00.000Z",
  "reviewedBy": "Finance Manager",
  "reviewComment": "Budget constraints for Q2. Please resubmit for Q3 planning."
}
```

---

## 📋 **Audit Logs Collection (`auditLogs`)**

Add these documents to the `auditLogs` collection:

### 1. Expense Created
```json
{
  "recordType": "expense",
  "reference": "EXP-2024-001",
  "action": "Expense Created",
  "performedBy": "John Smith",
  "performedAt": "2024-03-15T09:30:00.000Z",
  "amount": 1250.50,
  "details": "Office supplies and equipment for Engineering department"
}
```

### 2. Expense Approved
```json
{
  "recordType": "expense",
  "reference": "EXP-2024-001",
  "action": "Expense Approved",
  "performedBy": "Sarah Johnson",
  "performedAt": "2024-03-15T14:20:00.000Z",
  "amount": 1250.50,
  "details": "Office supplies expense approved for Engineering department"
}
```

### 3. Invoice Created
```json
{
  "recordType": "invoice",
  "reference": "INV-2024-045",
  "action": "Invoice Created",
  "performedBy": "Emily Davis",
  "performedAt": "2024-03-14T16:45:00.000Z",
  "amount": 15000.00,
  "details": "Monthly retainer invoice from Marketing Agency ABC"
}
```

### 4. Invoice Paid
```json
{
  "recordType": "invoice",
  "reference": "INV-2024-045",
  "action": "Invoice Paid",
  "performedBy": "Finance Manager",
  "performedAt": "2024-03-15T10:15:00.000Z",
  "amount": 15000.00,
  "details": "Payment processed for Marketing Agency ABC invoice"
}
```

### 5. Budget Updated
```json
{
  "recordType": "budget",
  "reference": "Engineering",
  "action": "Budget Updated",
  "performedBy": "Admin User",
  "performedAt": "2024-03-10T16:45:00.000Z",
  "amount": 150000,
  "previousAmount": 120000,
  "details": "Budget for Engineering updated from $120,000.00 to $150,000.00"
}
```

### 6. Budget Change Requested
```json
{
  "recordType": "budget",
  "reference": "Marketing",
  "action": "Budget Change Requested",
  "performedBy": "Mike Chen",
  "performedAt": "2024-03-14T14:20:00.000Z",
  "amount": 80000,
  "details": "Budget change requested for Marketing: $80,000.00"
}
```

### 7. Budget Proposal Approved
```json
{
  "recordType": "budget",
  "reference": "Sales",
  "action": "Budget Proposal Approved",
  "performedBy": "Admin User",
  "performedAt": "2024-03-11T16:45:00.000Z",
  "amount": 200000,
  "previousAmount": 150000,
  "details": "Budget proposal approved for Sales. Budget updated from $150,000.00 to $200,000.00"
}
```

### 8. Budget Proposal Rejected
```json
{
  "recordType": "budget",
  "reference": "Human Resources",
  "action": "Budget Proposal Rejected",
  "performedBy": "Finance Manager",
  "performedAt": "2024-03-09T13:20:00.000Z",
  "amount": 120000,
  "details": "Budget change proposal for Human Resources rejected - Budget constraints for Q2. Please resubmit for Q3 planning."
}
```

### 9. Expense Rejected
```json
{
  "recordType": "expense",
  "reference": "EXP-2024-002",
  "action": "Expense Rejected",
  "performedBy": "Finance Manager",
  "performedAt": "2024-03-13T11:45:00.000Z",
  "amount": 500.00,
  "details": "Expense rejected due to missing receipt and insufficient justification"
}
```

### 10. Invoice Overdue Flagged
```json
{
  "recordType": "invoice",
  "reference": "INV-2024-032",
  "action": "Invoice Flagged as Overdue",
  "performedBy": "System",
  "performedAt": "2024-03-15T00:00:00.000Z",
  "amount": 8500.00,
  "details": "Invoice from Vendor XYZ flagged as overdue - 15 days past due date"
}
```

---

## 📋 **Departments Collection (if not already exists)**

Make sure you have these departments in your `departments` collection:

### Engineering Department
```json
{
  "name": "Engineering",
  "budget": 120000,
  "spent": 85000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Marketing Department
```json
{
  "name": "Marketing",
  "budget": 100000,
  "spent": 72000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Sales Department
```json
{
  "name": "Sales",
  "budget": 150000,
  "spent": 110000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Human Resources Department
```json
{
  "name": "Human Resources",
  "budget": 90000,
  "spent": 65000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## 🔧 **How to Add This Data**

### Using Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Firestore Database
4. Click "Start collection" or select existing collection
5. Click "Add document" for each sample document above
6. Copy and paste the JSON data

### Using Firebase CLI:
```bash
# Add budget proposals
firebase firestore:import budgetProposals.json --collection budgetProposals

# Add audit logs
firebase firestore:import auditLogs.json --collection auditLogs
```

---

## 🧪 **Testing Scenarios**

### Budgets Page:
1. **Admin Role**: Should see "Edit Budget" buttons and can approve/reject proposals
2. **Manager Role**: Should see "Request Budget Change" button
3. **Finance Role**: Should see approve/reject buttons but not edit budget
4. **Employee Role**: Should only view budget overview

### Audit Trail Page:
1. **Admin/Finance/Manager Roles**: Should see all audit logs
2. **Employee Role**: Should see "Access Denied" message
3. **Filter by Record Type**: Test filtering by Expense/Invoice/Budget
4. **Search**: Test searching by reference, user name, or action
5. **Load More**: Test pagination with 20 records per page

### Workflow Testing:
1. Manager requests budget change → Creates budget proposal + audit log
2. Admin approves proposal → Updates department budget + creates audit logs
3. Finance processes invoice → Creates invoice audit logs
4. Users submit expenses → Creates expense audit logs

---

## 🎯 **Expected Results**

After adding this data, you should see:

- **Budgets Page**: 
  - 4 departments with budget overview cards
  - 2 pending budget proposals (Engineering increase, Marketing decrease)
  - 1 approved proposal (Sales)
  - 1 rejected proposal (HR)

- **Audit Trail Page**:
  - 10 audit logs showing various activities
  - Mix of expense, invoice, and budget records
  - Expandable log details
  - Working filters and search
  - Pagination with "Load More" button

This sample data provides comprehensive testing coverage for all features and user roles!
