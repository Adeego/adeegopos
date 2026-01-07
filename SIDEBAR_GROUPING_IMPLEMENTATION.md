# Sidebar Grouping Implementation

## Overview
The sidebar has been reorganized into 4 main groups with role-based access control using shadcn UI accordion components.

## Main Groups

### 1. Operator
**Icon:** Settings  
**Allowed Roles:** Admin, Operator  
**Pages:**
- Home (`/dashboard`)
- Store (`/productStore`)
- Adeego Plus (`/adeegoplus`)
- Suppliers (`/supplier`)
- Staff (`/staff`)
- Finance (`/finance`)
- Growth (`/growth`)
- Report (`/report`)

### 2. POS
**Icon:** Shopping Cart  
**Allowed Roles:** Admin, Operator, Worker, Cashier  
**Pages:**
- Sale (`/`)
- Products (`/product`)
- Customers (`/customers`)

### 3. Cashier
**Icon:** Dollar Sign  
**Allowed Roles:** Admin, Operator, Cashier  
**Pages:**
- Sales (`/cashier/sales`) - **NEW PAGE**
- Transactions (`/transactions`) - **NEW PAGE**

### 4. Stock Manager
**Icon:** Package  
**Allowed Roles:** Admin, Operator, Stock Manager  
**Pages:**
- Stock (`/product/restock`)
- Invoices (`/invoices`) - **NEW PAGE**

## Role-Based Access Control

### Cashier Role
- ✅ Access POS group (Sale, Products, Customers)
- ✅ Access Cashier group (Sales, Transactions)
- ❌ Cannot access Operator or Stock Manager groups

### Stock Manager Role
- ❌ Cannot access POS, Cashier, or Operator groups
- ✅ Access Stock Manager group only (Stock, Invoices)

### POS/Seller (Worker) Role
- ✅ Access POS group only (Sale, Products, Customers)
- ❌ Cannot access other groups

### Operator/Admin Role
- ✅ Access ALL groups (full access)
- ✅ Can see and navigate to all pages

## New Pages Created

### 1. Cashier Sales (`/pages/cashier/sales.js`)
**Purpose:** View personal sales for the logged-in cashier  
**Features:**
- Today's revenue display
- Sales count
- Cashier name
- Recent sales list with payment methods

### 2. Transactions (`/pages/transactions/index.js`)
**Purpose:** View all customer and supplier payment transactions  
**Features:**
- Customer payments tracking
- Supplier payments tracking
- Tabbed interface (All, Customers, Suppliers)
- Transaction filtering and display

### 3. Invoices (`/pages/invoices/index.js`)
**Purpose:** Manage supplier invoices  
**Features:**
- Invoice list with status (Paid, Pending, Overdue)
- Search functionality
- Invoice metrics (total, paid, pending)
- View and download actions

## UI Components Used

- **Accordion** - For grouped navigation with expandable sections
- **Tooltip** - For icon labels when sidebar is collapsed
- **Badge** - For payment methods and invoice statuses
- **Card** - For metric displays
- **Tabs** - For transaction filtering
- **Icons from Lucide React**

## Implementation Notes

### Sidebar Features
1. **Grouped Navigation:** All links are organized under their respective groups
2. **Collapsible Groups:** Each group can be expanded/collapsed using accordion
3. **Auto-expand:** All groups are expanded by default for better UX
4. **Collapsed View:** When sidebar is minimized, shows group icons with tooltips
5. **Active States:** Current page is highlighted in the navigation

### Role Mapping
The role-based access uses the `staff.role` property (converted to lowercase) to filter which groups are visible:
- `"admin"` → All groups
- `"operator"` → All groups
- `"cashier"` → POS + Cashier groups
- `"worker"` → POS group only
- `"stock_manager"` → Stock Manager group only

## Backend Requirements

The new pages expect the following backend operations (via `window.electronAPI.realmOperation`):

1. **getCashierSales** - Fetch sales by specific staff/cashier
2. **getAllTransactions** - Fetch all customer and supplier transactions
3. **getInvoices** - Fetch all supplier invoices
4. **transactionMetrics** - Already implemented for dashboard

## Testing Recommendations

1. Test with different user roles to verify access control
2. Verify new pages load data correctly from backend
3. Check mobile responsiveness of grouped sidebar
4. Test accordion expand/collapse functionality
5. Verify role-based filtering works correctly

## Future Enhancements

- Add invoice creation/editing functionality
- Add transaction filtering by date range
- Add export functionality for transactions and invoices
- Add real-time updates for cashier sales
- Add notifications for new transactions
