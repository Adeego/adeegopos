const customerService = require('../customerService');
const productService = require('../productService');
const saleService = require('../saleService');
const supplierService = require('../supplierService');
const dashboardService = require('../dashboardService');
const reportService = require('../reportService');
const growthService = require('../growthService');
const expenseService = require('../finance/expenseService');
const expenseTypeService = require('../finance/expenseTypeService');
const accountService = require('../finance/accountService');
const financeReport = require('../finance/financeReportService');
const transactionService = require('../finance/transactionService');
const financeRecorder = require('./financeRecorder');
const { v4: uuidv4 } = require('uuid');

// OpenAI function/tool definitions for the AI assistant
const toolDefinitions = [
  // ── Dashboard ──
  {
    type: 'function',
    function: {
      name: 'getTodaysSalesMetrics',
      description: 'Get today\'s sales metrics including revenue, number of sales, profit, and customer credit. Also returns yesterday\'s data for comparison.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTodaysExpenses',
      description: 'Get today\'s total expenses and yesterday\'s for comparison.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTransactionMetrics',
      description: 'Get today\'s transaction metrics: customer credit payments received and supplier payments made. Includes yesterday\'s data for comparison.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getHourlySalesData',
      description: 'Get hourly sales breakdown for today (7AM-10PM). Useful for identifying peak sales hours.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },

  // ── Sales ──
  {
    type: 'function',
    function: {
      name: 'getAllSalesBetweenDates',
      description: 'Get all individual sales between two dates. Returns full sale documents with items, payment method, customer, etc.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format (e.g. 2025-01-01)' },
          endDate: { type: 'string', description: 'End date in ISO format (e.g. 2025-01-31)' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSalesMetricsReport',
      description: 'Get sales metrics (revenue, profit, number of sales, credit given) for a date range with previous period comparison.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTopSellingItems',
      description: 'Get the top selling items by quantity for a given time period.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format' },
          endDate: { type: 'string', description: 'End date in ISO format' },
          limit: { type: 'number', description: 'Number of top items to return (default 10)' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSalesByCategory',
      description: 'Get sales breakdown by product category for a time period.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format' },
          endDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTotalSalesRevenueAndProfit',
      description: 'Get total number of sales, total revenue, and gross profit for a date range.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format' },
          endDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getDailySalesReport',
      description: 'Get daily sales totals for a date range. Useful for charting sales trends over time.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getUnpaidSalesBeforeToday',
      description: 'Get all unpaid credit sales from before today. Useful for identifying outstanding debts.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },

  // ── Customers & Debt ──
  {
    type: 'function',
    function: {
      name: 'getAllCustomers',
      description: 'Get all active customers with their balances. A negative balance means the customer owes money (debt).',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerById',
      description: 'Get a specific customer by their ID.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'The customer document ID' }
        },
        required: ['customerId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerLedger',
      description: 'Get a customer\'s ledger showing all credit sales and transactions (payments). Shows debit/credit entries sorted by date.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'The customer document ID' },
          fromDate: { type: 'string', description: 'Optional start date in ISO format' },
          toDate: { type: 'string', description: 'Optional end date in ISO format' }
        },
        required: ['customerId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerAging',
      description: 'Get aging analysis for a customer\'s debt, broken into 0-30 days, 30-60 days, and 60+ days buckets.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'The customer document ID' }
        },
        required: ['customerId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTodayCreditSales',
      description: 'Get all credit sales made today.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTopCustomers',
      description: 'Get the top customers by total purchase amount for a date range.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format' },
          endDate: { type: 'string', description: 'End date in ISO format' },
          limit: { type: 'number', description: 'Number of top customers to return (default 10)' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },

  // ── Products & Stock ──
  {
    type: 'function',
    function: {
      name: 'getAllProducts',
      description: 'Get all active products with stock levels, prices, categories, and restock status.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProductsToRestock',
      description: 'Get products that need restocking (stock below threshold or flagged for restock).',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getExpiringProducts',
      description: 'Get products with batches expiring within a given number of days.',
      parameters: {
        type: 'object',
        properties: {
          daysUntilExpiry: { type: 'number', description: 'Number of days to look ahead for expiring products (e.g. 30)' }
        },
        required: ['daysUntilExpiry']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getRestockList',
      description: 'Get the current restock shopping list organized by category (Primary, Secondary, Perishable, Drinks).',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional category filter: Primary, Secondary, Perishable, or Drinks' }
        },
        required: []
      }
    }
  },

  // ── Suppliers ──
  {
    type: 'function',
    function: {
      name: 'getAllSuppliers',
      description: 'Get all active suppliers with their balances and contact info.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTodayInvoices',
      description: 'Get all supplier invoices created today.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTodaySupplierTransactions',
      description: 'Get all supplier payment transactions made today.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },

  // ── Finance ──
  {
    type: 'function',
    function: {
      name: 'incomeStatement',
      description: 'Generate an income statement (P&L) for a date range. Shows revenue by payment method, COGS, expenses by type, and net income.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getBalanceSheet',
      description: 'Generate a balance sheet as of a given date. Shows assets, liabilities, and equity.',
      parameters: {
        type: 'object',
        properties: {
          toDate: { type: 'string', description: 'Date to generate balance sheet as of (ISO format)' }
        },
        required: ['toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTrialBalance',
      description: 'Generate a trial balance for a date range showing all account debits and credits.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAccountStatement',
      description: 'Get all transactions for a date range with total amount.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAllExpenses',
      description: 'Get all expenses for the store.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getExpensesReport',
      description: 'Get expense totals for a date range with previous period comparison.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTransactionMetricsReport',
      description: 'Get transaction metrics (customer credits received, supplier payments) for a date range with previous period comparison.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Start date in ISO format' },
          toDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['fromDate', 'toDate']
      }
    }
  },

  // ── Growth Analytics ──
  {
    type: 'function',
    function: {
      name: 'getGrowthMetrics',
      description: 'Get overall growth metrics for the store including trends and key performance indicators.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWeeklySalesGrowth',
      description: 'Get week-over-week sales growth data for a date range.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format' },
          endDate: { type: 'string', description: 'End date in ISO format' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTopPerformingProducts',
      description: 'Get top performing products by revenue for a date range.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO format' },
          endDate: { type: 'string', description: 'End date in ISO format' },
          limit: { type: 'number', description: 'Number of products to return (default 10)' }
        },
        required: ['startDate', 'endDate']
      }
    }
  },
  // ── Actions ──
  {
    type: 'function',
    function: {
      name: 'getAllExpenseTypes',
      description: 'Get all expense types/categories available in the store',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAllAccounts',
      description: 'Get all financial accounts (e.g. Cash, M-Pesa, Bank) available in the store',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getRecordingReferenceData',
      description: 'Get valid accounts, expense types, customers, and suppliers before drafting a financial record.',
      parameters: {
        type: 'object',
        properties: {
          include: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['accounts', 'expenseTypes', 'customers', 'suppliers']
            },
            description: 'Optional list of reference groups to fetch.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draftFinanceRecord',
      description: 'Prepare and validate an expense, customer transaction, supplier transaction, or supplier invoice. This does not write anything. Always show the returned summary to the user and ask for confirmation before committing.',
      parameters: {
        type: 'object',
        properties: {
          recordType: {
            type: 'string',
            enum: ['expense', 'customer_payment', 'customer_refund', 'supplier_payment', 'supplier_refund', 'supplier_invoice'],
            description: 'The type of record to prepare.'
          },
          amount: { type: 'number', description: 'Amount in KES. For invoices this may be omitted if items with subtotals are provided.' },
          totalAmount: { type: 'number', description: 'Invoice total amount in KES.' },
          description: { type: 'string', description: 'Human-readable description or memo.' },
          date: { type: 'string', description: 'Date in ISO format. If omitted, today is used.' },
          transactionCost: { type: 'number', description: 'Transaction fee in KES, if any.' },
          accountId: { type: 'string', description: 'Exact account ID, preferred when known.' },
          accountName: { type: 'string', description: 'Account name, such as Cash Drawer or M-Pesa Till.' },
          customerId: { type: 'string', description: 'Exact customer ID, preferred when known.' },
          customerName: { type: 'string', description: 'Customer name for customer transactions.' },
          supplierId: { type: 'string', description: 'Exact supplier ID, preferred when known.' },
          supplierName: { type: 'string', description: 'Supplier name for supplier transactions or invoices.' },
          expenseTypeId: { type: 'string', description: 'Exact expense type ID, preferred when known.' },
          expenseTypeName: { type: 'string', description: 'Expense type/category name for expenses.' },
          reference: { type: 'string', description: 'Optional external receipt or invoice reference.' },
          items: {
            type: 'array',
            description: 'Optional supplier invoice line items.',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                productName: { type: 'string' },
                name: { type: 'string' },
                quantity: { type: 'number' },
                buyPrice: { type: 'number' },
                subtotal: { type: 'number' }
              }
            }
          }
        },
        required: ['recordType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'commitFinanceRecord',
      description: 'Commit a previously drafted finance record after the user explicitly confirms the exact summary.',
      parameters: {
        type: 'object',
        properties: {
          confirmationToken: { type: 'string', description: 'The token returned by draftFinanceRecord.' }
        },
        required: ['confirmationToken']
      }
    }
  },
];

// Execute a tool call and return the result
async function executeTool(toolName, args, db, storeNo) {
  try {
    switch (toolName) {
      // Dashboard
      case 'getTodaysSalesMetrics':
        return await dashboardService.getTodaysSalesMetrics(db, storeNo);
      case 'getTodaysExpenses':
        return await dashboardService.getTodaysExpenses(db, storeNo);
      case 'getTransactionMetrics':
        return await dashboardService.transactionMetrics(db, storeNo);
      case 'getHourlySalesData':
        return await dashboardService.getHourlySalesData(db, storeNo);

      // Sales
      case 'getAllSalesBetweenDates':
        return await saleService.getAllSalesBetweenDates(db, storeNo, args.startDate, args.endDate);
      case 'getSalesMetricsReport':
        return await reportService.getSalesMetricsReport(db, args.fromDate, args.toDate);
      case 'getTopSellingItems':
        return await saleService.getTopSellingItems(db, storeNo, args.startDate, args.endDate, args.limit || 10);
      case 'getSalesByCategory':
        return await saleService.getSalesByCategory(db, storeNo, args.startDate, args.endDate);
      case 'getTotalSalesRevenueAndProfit':
        return await saleService.getTotalSalesRevenueAndProfit(db, storeNo, args.startDate, args.endDate);
      case 'getDailySalesReport':
        return await reportService.getDailySalesReport(db, args.fromDate, args.toDate);
      case 'getUnpaidSalesBeforeToday':
        return await saleService.getUnpaidSalesBeforeToday(db, storeNo);

      // Customers & Debt
      case 'getAllCustomers':
        return await customerService.getAllCustomers(db, storeNo);
      case 'getCustomerById':
        return await customerService.getCustomerById(db, args.customerId);
      case 'getCustomerLedger':
        return await customerService.getCustomerLedger(db, args.customerId, args.fromDate, args.toDate, storeNo);
      case 'getCustomerAging':
        return await customerService.getCustomerAging(db, args.customerId, storeNo);
      case 'getTodayCreditSales':
        return await customerService.getTodayCreditSales(db, storeNo);
      case 'getTopCustomers':
        return await saleService.getTopCustomers(db, storeNo, args.startDate, args.endDate, args.limit || 10);

      // Products & Stock
      case 'getAllProducts':
        return await productService.getAllProducts(db, storeNo);
      case 'getProductsToRestock': {
        const result = await productService.getAllProducts(db, storeNo);
        if (!result.success) return result;
        return {
          success: true,
          products: result.products.filter((product) => product.restock
            || Number(product.stock || 0) <= Number(product.restockThreshold || 0)),
        };
      }
      case 'getExpiringProducts':
        return await productService.getExpiringProducts(db, storeNo, args.daysUntilExpiry);
      case 'getRestockList': {
        const result = await productService.getAllProducts(db, storeNo);
        if (!result.success) return result;
        const items = {};
        result.products
          .filter((product) => product.restock || Number(product.stock || 0) <= Number(product.restockThreshold || 0))
          .forEach((product) => {
            const category = product.category || 'Uncategorized';
            if (!items[category]) items[category] = [];
            items[category].push(product);
          });
        return { success: true, items };
      }

      // Suppliers
      case 'getAllSuppliers':
        return await supplierService.getAllSuppliers(db, storeNo);
      case 'getTodayInvoices':
        return await supplierService.getTodayInvoices(db, storeNo);
      case 'getTodaySupplierTransactions':
        return await supplierService.getTodaySupplierTransactions(db, storeNo);

      // Finance
      case 'incomeStatement':
        return await financeReport.incomeStatement(db, args.fromDate, args.toDate, storeNo);
      case 'getBalanceSheet':
        return await financeReport.getBalanceSheet(db, args.toDate, storeNo);
      case 'getTrialBalance':
        return await financeReport.getTrialBalance(db, args.fromDate, args.toDate, storeNo);
      case 'getAccountStatement':
        return await financeReport.getAccountStatement(db, args.fromDate, args.toDate, storeNo);
      case 'getAllExpenses':
        return await expenseService.getAllExpenses(db, storeNo);
      case 'getAllExpenseTypes':
        return await expenseTypeService.getAllExpenseTypes(db, storeNo);
      case 'getAllAccounts':
        return await accountService.getAllAccounts(db, storeNo);
      case 'getRecordingReferenceData':
        return await financeRecorder.getRecordingReferenceData(db, args, storeNo);
      case 'draftFinanceRecord':
        return await financeRecorder.draftFinanceRecord(db, args, storeNo);
      case 'commitFinanceRecord':
        return await financeRecorder.commitFinanceRecord(db, args, storeNo);
      case 'createExpense': {
        // Resolve expense type name → ID
        const typesResult = await expenseTypeService.getAllExpenseTypes(db, storeNo);
        const matchedType = typesResult.success
          ? typesResult.expenseTypes.find(t => t.name.toLowerCase() === args.expenseType.toLowerCase())
          : null;
        if (!matchedType) {
          return { success: false, error: `Expense type "${args.expenseType}" not found. Use getAllExpenseTypes to see available types.` };
        }

        // Resolve account name → ID
        const accsResult = await accountService.getAllAccounts(db, storeNo);
        const matchedAccount = accsResult.success
          ? accsResult.accounts.find(a => a.name.toLowerCase() === args.account.toLowerCase())
          : null;
        if (!matchedAccount) {
          return { success: false, error: `Account "${args.account}" not found. Use getAllAccounts to see available accounts.` };
        }

        const expenseData = {
          _id: `${storeNo}:${uuidv4()}`,
          description: args.description,
          amount: Number(args.amount),
          transactionCost: Number(args.transactionCost) || 0,
          date: args.date ? new Date(args.date).toISOString() : new Date().toISOString(),
          account: matchedAccount.name,
          accountId: matchedAccount._id,
          expenseType: matchedType.name,
          expenseTypeId: matchedType._id,
          storeNo: storeNo,
        };

        return await expenseService.createExpense(db, expenseData);
      }
      case 'getExpensesReport':
        return await reportService.getExpensesReport(db, args.fromDate, args.toDate);
      case 'getTransactionMetricsReport':
        return await reportService.getTransactionMetricsReport(db, args.fromDate, args.toDate);

      // Growth
      case 'getGrowthMetrics':
        return await growthService.getGrowthMetrics(db, storeNo);
      case 'getWeeklySalesGrowth':
        return await growthService.getWeeklySalesGrowth(db, storeNo, args.startDate, args.endDate);
      case 'getTopPerformingProducts':
        return await growthService.getTopPerformingProducts(db, storeNo, args.startDate, args.endDate, args.limit || 10);

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`[AI Tool] Error executing ${toolName}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { toolDefinitions, executeTool };
