import { Loader2 } from 'lucide-react';

const toolLabels = {
  getTodaysSalesMetrics: 'Checking today\'s sales',
  getTodaysExpenses: 'Checking today\'s expenses',
  getTransactionMetrics: 'Checking transactions',
  getHourlySalesData: 'Loading hourly sales',
  getAllSalesBetweenDates: 'Fetching sales data',
  getSalesMetricsReport: 'Generating sales report',
  getTopSellingItems: 'Finding top sellers',
  getSalesByCategory: 'Analyzing categories',
  getTotalSalesRevenueAndProfit: 'Calculating revenue & profit',
  getDailySalesReport: 'Loading daily sales',
  getUnpaidSalesBeforeToday: 'Checking unpaid sales',
  getAllCustomers: 'Loading customers',
  getCustomerById: 'Loading customer info',
  getCustomerLedger: 'Loading customer ledger',
  getCustomerAging: 'Analyzing debt aging',
  getTodayCreditSales: 'Checking credit sales',
  getTopCustomers: 'Finding top customers',
  getAllProducts: 'Loading products',
  getProductsToRestock: 'Checking restock needs',
  getExpiringProducts: 'Checking expiring products',
  getRestockList: 'Loading restock list',
  getLatestStockAiPlan: 'Loading Stock AI action plan',
  getStockIntelligenceReport: 'Building Stock AI intelligence report',
  getAllSuppliers: 'Loading suppliers',
  getTodayInvoices: 'Checking invoices',
  getTodaySupplierTransactions: 'Checking supplier payments',
  incomeStatement: 'Generating income statement',
  getBalanceSheet: 'Generating balance sheet',
  getTrialBalance: 'Generating trial balance',
  getAccountStatement: 'Loading account statement',
  getAllExpenses: 'Loading expenses',
  getExpensesReport: 'Generating expense report',
  getTransactionMetricsReport: 'Analyzing transactions',
  getGrowthMetrics: 'Analyzing growth',
  getWeeklySalesGrowth: 'Calculating weekly growth',
  getTopPerformingProducts: 'Finding top products',
};

export default function ToolCallIndicator({ toolName }) {
  const label = toolLabels[toolName] || toolName;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-3">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{label}...</span>
    </div>
  );
}
