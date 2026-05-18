# AdeegoPOS Database Structure (Analysis-Relevant Collections)

All documents live in a single PouchDB database, differentiated by the `type` field.
Every document shares these common fields: `_id`, `_rev`, `type`, `state` ("Active"/"Inactive"), `storeNo`, `createdAt`, `updatedAt`.

---

## 1. Sale (`type: "sale"`)

Core revenue document. Each sale captures a full transaction at the register.

| Field             | Type     | Description                                      |
|-------------------|----------|--------------------------------------------------|
| `_id`             | string   | Unique sale ID                                   |
| `customerId`      | string   | Reference to customer (nullable for walk-ins)     |
| `items`           | array    | Line items (see sub-schema below)                |
| `totalAmount`     | number   | Final sale total                                 |
| `totalItems`      | number   | Count of line items                              |
| `totalDiscount`   | number   | Total discount applied                           |
| `servedBy`        | string   | Staff ID who processed the sale                  |
| `amountPaid`      | number   | Amount tendered by customer                      |
| `change`          | number   | Change returned                                  |
| `note`            | string   | Optional sale note                               |
| `paymentMethod`   | string   | `CASH` / `CREDIT` / `MPESA`                     |
| `saleType`        | string   | `NEW SALE` / `RETURN SALE`                       |
| `fullfilmentType` | string   | `DELIVERY` / `WALK-IN-CLIENT`                    |
| `paid`            | boolean  | Whether the sale is fully paid                   |
| `createdAt`       | ISO date | Sale timestamp                                   |

### Sale Item (embedded in `items[]`)

| Field              | Type   | Description                          |
|--------------------|--------|--------------------------------------|
| `_id`              | string | Item line ID                         |
| `productId`        | string | Reference to product                 |
| `name`             | string | Product/variant name                 |
| `buyPrice`         | number | Cost price at time of sale           |
| `unitPrice`        | number | Selling price per unit               |
| `quantity`         | number | Quantity sold                        |
| `subtotal`         | number | Line total (unitPrice × quantity)    |
| `discount`         | number | Discount on this line                |
| `conversionFactor` | number | Unit conversion (e.g. box → piece)   |

**Analysis use:** Revenue, profit margins, top products, sales trends, payment mix, staff performance, fulfillment analysis, customer purchase patterns.

---

## 2. Product (`type: "product"`)

Inventory item with embedded variants.

| Field              | Type    | Description                                  |
|--------------------|---------|----------------------------------------------|
| `_id`              | string  | Unique product ID                            |
| `name`             | string  | Product name                                 |
| `uom`              | string  | Base unit of measure                         |
| `buyPrice`         | number  | Current cost/purchase price                  |
| `stock`            | number  | Current stock level (in base units)          |
| `variants`         | array   | Selling variants (see sub-schema)            |
| `category`         | string  | `Primary` / `Secondary` / `Perishable` / `Drinks` / `Reserve` |
| `restockThreshold` | number  | Auto-calculated restock trigger level        |
| `restockPeriod`    | number  | Days between restocks                        |
| `restock`          | boolean | Whether restock alert is active              |
| `barCode`          | string  | Optional barcode                             |
| `batches`          | array   | Stock batches with expiry tracking (see sub-schema) |

### Product Batch (embedded in `batches[]`)

| Field              | Type   | Description                              |
|--------------------|--------|------------------------------------------|
| `batchId`          | string | Unique batch ID (UUID)                   |
| `expiryDate`       | string | Expiry date (ISO date string, nullable)  |
| `quantity`         | number | Remaining quantity in base units         |
| `addedAt`          | string | Timestamp when batch was added           |

### Product Variant (embedded in `variants[]`)

| Field              | Type   | Description                              |
|--------------------|--------|------------------------------------------|
| `_id`              | string | Variant ID                               |
| `productId`        | string | Parent product reference                 |
| `name`             | string | Variant name (e.g. "Box", "Piece")       |
| `conversionFactor` | number | How many base units per variant unit     |
| `unitPrice`        | number | Selling price for this variant           |

**Analysis use:** Stock valuation, inventory turnover, restock forecasting, category performance, price analysis.

---

## 3. Customer (`type: "customer"`)

| Field         | Type    | Description                                      |
|---------------|---------|--------------------------------------------------|
| `_id`         | string  | Unique customer ID                               |
| `name`        | string  | Customer name                                    |
| `phoneNumber` | string  | Phone number                                     |
| `address`     | string  | Address                                          |
| `balance`     | number  | Current balance (negative = owes, positive = credit) |
| `credit`      | number  | Credit limit                                     |
| `status`      | string  | Customer status                                  |

**Analysis use:** Customer lifetime value, credit/debt aging (0-30, 30-60, 60+ days), ledger analysis, top customers, receivables.

---

## 4. Supplier (`type: "supplier"`)

| Field         | Type   | Description                              |
|---------------|--------|------------------------------------------|
| `_id`         | string | Unique supplier ID                       |
| `name`        | string | Supplier name                            |
| `phoneNumber` | string | Phone number                             |
| `address`     | string | Address                                  |
| `balance`     | number | Amount owed to supplier                  |

**Analysis use:** Payables tracking, supplier spend analysis.

---

## 5. Transaction (`type: "transaction"`)

Tracks money movement between customers, suppliers, and accounts.

| Field             | Type   | Description                                          |
|-------------------|--------|------------------------------------------------------|
| `_id`             | string | Unique transaction ID                                |
| `from`            | string | Source entity ID (customer/supplier/account)          |
| `to`              | string | Destination entity ID                                |
| `source`          | string | Source type: `customer` / `account`                  |
| `destination`     | string | Destination type: `account` / `supplier`             |
| `description`     | string | Transaction description                              |
| `amount`          | number | Transaction amount                                   |
| `transactionCost` | number | Any fees (e.g. M-Pesa charges)                       |
| `date`            | string | Transaction date                                     |
| `transType`       | string | `deposit` (increases balance) / `withdraw` (decreases) |

**Analysis use:** Cash flow analysis, customer payment tracking, supplier payment tracking, transaction cost analysis.

---

## 6. Expense (`type: "expense"`)

| Field           | Type   | Description                        |
|-----------------|--------|------------------------------------|
| `_id`           | string | Unique expense ID                  |
| `description`   | string | Expense description                |
| `amount`        | number | Expense amount                     |
| `transactionCost` | number | Associated fees                 |
| `date`          | string | Expense date                       |
| `account`       | string | Account name used                  |
| `expenseType`   | string | Category name                      |
| `expenseTypeId` | string | Reference to expense type          |

**Analysis use:** Expense tracking, expense categorization, profitability (revenue − COGS − expenses).

---

## 7. Expense Type (`type: "expenseType"`)

| Field         | Type   | Description              |
|---------------|--------|--------------------------|
| `_id`         | string | Unique ID                |
| `name`        | string | Category name            |
| `description` | string | Category description     |

**Analysis use:** Expense categorization and grouping.

---

## 8. Account (`type: "account"`)

Financial accounts (e.g. Cash register, M-Pesa).

| Field           | Type   | Description                                      |
|-----------------|--------|--------------------------------------------------|
| `_id`           | string | Unique account ID                                |
| `name`          | string | Account name                                     |
| `accountNumber` | string | Account number (e.g. `{storeNo}001` = Cash, `{storeNo}002` = M-Pesa) |
| `accountType`   | string | Account type                                     |
| `balance`       | number | Current balance                                  |

**Analysis use:** Cash position, account reconciliation, payment channel analysis.

---

## 9. Invoice (`type: "invoice"`)

Supplier purchase invoices created during restocking.

| Field        | Type   | Description                    |
|--------------|--------|--------------------------------|
| `_id`        | string | Unique invoice ID              |
| `supplierId` | string | Reference to supplier          |
| *(varies)*   | —      | Invoice line items and totals  |

**Analysis use:** Purchase/procurement analysis, supplier spend.

---

## 10. Staff (`type: "staff"`)

| Field       | Type   | Description                                          |
|-------------|--------|------------------------------------------------------|
| `_id`       | string | Unique staff ID                                      |
| `firstName` | string | First name                                           |
| `lastName`  | string | Last name                                            |
| `phone`     | string | Phone number                                         |
| `balance`   | number | Staff balance                                        |
| `passcode`  | string | Login passcode                                       |
| `salary`    | number | Salary amount                                        |
| `role`      | string | `admin` / `operator` / `cashier` / `worker` / `stock_manager` |

**Analysis use:** Staff sales performance (via `sale.servedBy`), labor cost analysis.

---

## Key Relationships

```
Sale.customerId        → Customer._id
Sale.servedBy          → Staff._id
Sale.items[].productId → Product._id
Transaction.from/to    → Customer._id / Supplier._id / Account._id
Expense.expenseTypeId  → ExpenseType._id
Invoice.supplierId     → Supplier._id
```

## Analysis Dimensions Summary

| Dimension              | Source Collections              |
|------------------------|--------------------------------|
| **Revenue & Profit**   | Sale, Sale.items               |
| **Sales Trends**       | Sale (by createdAt)            |
| **Payment Mix**        | Sale.paymentMethod             |
| **Product Performance**| Sale.items, Product            |
| **Inventory Health**   | Product (stock, restock)       |
| **Customer Analytics** | Customer, Sale, Transaction    |
| **Supplier Analytics** | Supplier, Invoice, Transaction |
| **Expense Tracking**   | Expense, ExpenseType           |
| **Cash Flow**          | Account, Transaction, Expense  |
| **Staff Performance**  | Staff, Sale.servedBy           |
| **Fulfillment**        | Sale.fullfilmentType           |
| **Growth Projections** | Sale (time-series regression)  |
