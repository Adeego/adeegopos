const {
  ACCESS_VERSION, ACCESS_LEVELS, MODULE_IDS, MODULE_REGISTRY, MODULE_OPTIONS,
  ACCESS_PRESETS, PRESET_OPTIONS, normalizeModuleAccess, getPresetAccess,
  mapLegacyRolesToAccess, inferPresetFromLegacyRoles, getEffectiveModuleAccess,
  hasModuleLevel, satisfiesRequirement,
} = require('./modules');

const ROLES = Object.freeze({ ADMIN: 'admin', OPERATOR: 'operator', SELLER: 'seller', CASHIER: 'cashier', STOCK_MANAGER: 'stock_manager', BOOKKEEPER: 'bookkeeper' });
const ROLE_LABELS = Object.freeze({ admin: 'Admin', operator: 'Operator', seller: 'Seller', cashier: 'Cashier', stock_manager: 'Stock Manager', bookkeeper: 'Bookkeeper' });
const ROLE_OPTIONS = Object.values(ROLES).map((value) => ({ value, label: ROLE_LABELS[value] }));
const ROLE_ALIASES = Object.freeze({
  admin: ROLES.ADMIN, administrator: ROLES.ADMIN, operator: ROLES.OPERATOR, manager: ROLES.OPERATOR,
  worker: ROLES.SELLER, seller: ROLES.SELLER, salesperson: ROLES.SELLER, cashier: ROLES.CASHIER,
  stock_manager: ROLES.STOCK_MANAGER, stockmanager: ROLES.STOCK_MANAGER, 'stock manager': ROLES.STOCK_MANAGER,
  bookkeeper: ROLES.BOOKKEEPER, accountant: ROLES.BOOKKEEPER,
});
const ROLE_PRIORITY = [ROLES.ADMIN, ROLES.OPERATOR, ROLES.BOOKKEEPER, ROLES.STOCK_MANAGER, ROLES.CASHIER, ROLES.SELLER];

const requirement = (module, level = ACCESS_LEVELS.VIEW) => ({ module, level });
const any = (...entries) => ({ any: entries });
const authenticated = { authenticated: true };

const PERMISSION_REQUIREMENTS = Object.freeze({
  'assistant:use': any(requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE)),
  'cashier:manage': requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE),
  'customer:read': any(requirement(MODULE_IDS.CUSTOMERS), requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING), requirement(MODULE_IDS.ADEEGO_PLUS)),
  'customer:write': requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.OPERATE),
  'customer:credit': requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE),
  'finance:read': requirement(MODULE_IDS.BOOKKEEPING),
  'finance:write': requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE),
  'growth:read': requirement(MODULE_IDS.REPORTS),
  'message:read': requirement(MODULE_IDS.STAFF_ADMIN),
  'message:write': requirement(MODULE_IDS.STAFF_ADMIN, ACCESS_LEVELS.OPERATE),
  'pos:sell': requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE),
  'product:read': any(requirement(MODULE_IDS.INVENTORY), requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.OPERATE)),
  'product:write': requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE),
  'reconciliation:read': requirement(MODULE_IDS.BOOKKEEPING),
  'reconciliation:create': any(requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE)),
  'reconciliation:approve': requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  'report:read': requirement(MODULE_IDS.REPORTS),
  'sale:confirmPayment': requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE),
  'staff:read': requirement(MODULE_IDS.STAFF_ADMIN),
  'staff:manageRoles': requirement(MODULE_IDS.STAFF_ADMIN, ACCESS_LEVELS.OPERATE),
  'stock:manage': requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE),
  'subscription:manage': requirement(MODULE_IDS.ADEEGO_PLUS, ACCESS_LEVELS.MANAGE),
  'supplier:manage': requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.MANAGE),
  'supplier:invoice': any(requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING)),
  'transaction:read': any(requirement(MODULE_IDS.BOOKKEEPING), requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE)),
});

const ROUTE_RULES = Object.freeze([
  { pattern: '/', requirement: requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE) },
  { pattern: '/auth/logout', requirement: authenticated }, { pattern: '/home', requirement: authenticated },
  { pattern: '/cashier/sales', requirement: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE)) },
  { pattern: '/cashier/shifts', requirement: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE)) },
  { pattern: '/cashier/monthly-pl', requirement: requirement(MODULE_IDS.BOOKKEEPING) },
  { pattern: '/cashier/balance-sheet', requirement: requirement(MODULE_IDS.BOOKKEEPING) },
  { pattern: '/pos', requirement: requirement(MODULE_IDS.POS), prefix: true },
  { pattern: '/customers/manageCredit', requirement: requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE) },
  { pattern: '/customers', requirement: requirement(MODULE_IDS.CUSTOMERS), prefix: true },
  { pattern: '/product/restock', requirement: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE) },
  { pattern: '/product', requirement: requirement(MODULE_IDS.INVENTORY), prefix: true },
  { pattern: '/stock/audit', requirement: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE) },
  { pattern: '/stock/restock-list', requirement: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE) },
  { pattern: '/stock', requirement: requirement(MODULE_IDS.INVENTORY), prefix: true },
  { pattern: '/supplier/invoices', requirement: requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.OPERATE) },
  { pattern: '/supplier', requirement: requirement(MODULE_IDS.SUPPLIERS), prefix: true },
  { pattern: '/invoices', requirement: any(requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING)) },
  { pattern: '/transactions', requirement: requirement(MODULE_IDS.BOOKKEEPING) },
  { pattern: '/finance', requirement: requirement(MODULE_IDS.BOOKKEEPING), prefix: true },
  { pattern: '/reconciliation', requirement: requirement(MODULE_IDS.BOOKKEEPING) },
  { pattern: '/dashboard', requirement: requirement(MODULE_IDS.REPORTS) },
  { pattern: '/report', requirement: requirement(MODULE_IDS.REPORTS) }, { pattern: '/growth', requirement: requirement(MODULE_IDS.REPORTS) },
  { pattern: '/staff', requirement: requirement(MODULE_IDS.STAFF_ADMIN), prefix: true },
  { pattern: '/productStore', requirement: { owner: true } },
  { pattern: '/adeegoPos/subscription', requirement: { owner: true } },
  { pattern: '/adeegoPos/support', requirement: requirement(MODULE_IDS.STAFF_ADMIN) },
  { pattern: '/adeegoPos/termsConditions', requirement: authenticated },
  { pattern: '/adeegoplus', requirement: requirement(MODULE_IDS.ADEEGO_PLUS), prefix: true },
]);

const OPERATION_REQUIREMENTS = Object.freeze({
  getAllCustomers: PERMISSION_REQUIREMENTS['customer:read'], getCustomerById: PERMISSION_REQUIREMENTS['customer:read'], searchCustomers: PERMISSION_REQUIREMENTS['customer:read'],
  getCustomerSales: any(requirement(MODULE_IDS.CUSTOMERS), requirement(MODULE_IDS.BOOKKEEPING), requirement(MODULE_IDS.REPORTS)),
  getCustomerLedger: any(requirement(MODULE_IDS.CUSTOMERS), requirement(MODULE_IDS.BOOKKEEPING)),
  getCustomerAging: any(requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING)),
  getCustomerCreditOverview: any(requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING)),
  getTodayCreditSales: any(requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING), requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE)),
  getTodayCustomerTransactions: any(requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING), requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE)),
  createCustomer: requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.OPERATE), updateCustomer: requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.OPERATE), deleteCustomer: requirement(MODULE_IDS.CUSTOMERS, ACCESS_LEVELS.MANAGE),

  getAllProducts: PERMISSION_REQUIREMENTS['product:read'], getAllVariants: PERMISSION_REQUIREMENTS['product:read'], getProductById: PERMISSION_REQUIREMENTS['product:read'],
  getExpiringProducts: requirement(MODULE_IDS.INVENTORY), getSaleItemsByProductId: any(requirement(MODULE_IDS.INVENTORY), requirement(MODULE_IDS.REPORTS)), getSaleProducts: any(requirement(MODULE_IDS.INVENTORY), requirement(MODULE_IDS.BOOKKEEPING)),
  addNewProduct: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE), updateProduct: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE), archiveProduct: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE),
  addNewVariant: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE), updateVariant: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE), removeVariant: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE), removeBatch: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE),
  restockProducts: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), createAudit: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), getDailyAudit: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), printAuditSheets: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), submitAudit: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE),
  approveAudit: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE), rejectAudit: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.MANAGE),
  getAudit: requirement(MODULE_IDS.INVENTORY), getAuditHistory: requirement(MODULE_IDS.INVENTORY), getAuditSummary: requirement(MODULE_IDS.INVENTORY), getOpenAudits: requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE),

  createSale: requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE), printReceipt: requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE),
  getSaleById: any(requirement(MODULE_IDS.POS), requirement(MODULE_IDS.BOOKKEEPING), requirement(MODULE_IDS.REPORTS)),
  getAllSalesBetweenDates: any(requirement(MODULE_IDS.POS), requirement(MODULE_IDS.REPORTS)), getFailedSalesBetweenDates: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.REPORTS)),
  getCashierSales: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.REPORTS)), getShiftSales: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING)), getTodaySalesByPaidStatus: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING)),
  getUnpaidSalesBeforeToday: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING)), getPendingSalesByMonth: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING)), updateSalePaidStatus: requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE),
  getRegisterSession: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE)), getRegisterSessionHistory: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE)), openRegisterSession: requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), takeOverRegisterSession: requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), closeRegisterSession: any(requirement(MODULE_IDS.POS, ACCESS_LEVELS.MANAGE), requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE)),
  getAllSuppliers: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING)),
  getSupplierById: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.BOOKKEEPING)),
  getSupplierStatement: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.BOOKKEEPING)), getTodaySupplierTransactions: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.BOOKKEEPING)),
  createSupplier: requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.MANAGE), updateSupplier: requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.MANAGE), archiveSupplier: requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.MANAGE),
  createInvoice: any(requirement(MODULE_IDS.SUPPLIERS, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE)),
  getInvoices: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.INVENTORY), requirement(MODULE_IDS.BOOKKEEPING)), getTodayInvoices: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.INVENTORY), requirement(MODULE_IDS.BOOKKEEPING)), getInvoiceById: any(requirement(MODULE_IDS.SUPPLIERS), requirement(MODULE_IDS.INVENTORY), requirement(MODULE_IDS.BOOKKEEPING)),

  getSalePaymentAccounts: requirement(MODULE_IDS.POS, ACCESS_LEVELS.OPERATE),
  getAllAccounts: requirement(MODULE_IDS.BOOKKEEPING), getAccountById: requirement(MODULE_IDS.BOOKKEEPING), getAccountStatement: requirement(MODULE_IDS.BOOKKEEPING),
  createAccount: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), updateAccount: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), archiveAccount: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  getAllExpenses: requirement(MODULE_IDS.BOOKKEEPING), getExpenseById: requirement(MODULE_IDS.BOOKKEEPING), createExpense: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), updateExpense: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), archiveExpense: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  getAllTransactions: requirement(MODULE_IDS.BOOKKEEPING), getTodayTransactions: requirement(MODULE_IDS.BOOKKEEPING), getTransactionById: requirement(MODULE_IDS.BOOKKEEPING), createTransaction: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), updateTransaction: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), archiveTransaction: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  createExpenseType: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), getAllExpenseTypes: requirement(MODULE_IDS.BOOKKEEPING), getExpenseTypeById: requirement(MODULE_IDS.BOOKKEEPING), updateExpenseType: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), archiveExpenseType: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  createBalanceSheetEntry: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), getAllBalanceSheets: requirement(MODULE_IDS.BOOKKEEPING), getBalanceSheetById: requirement(MODULE_IDS.BOOKKEEPING), updateBalanceSheet: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), archiveBalanceSheet: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  incomeStatement: requirement(MODULE_IDS.BOOKKEEPING), getMonthlyProfitLoss: requirement(MODULE_IDS.BOOKKEEPING), getBalanceSheet: requirement(MODULE_IDS.BOOKKEEPING), getChartOfAccounts: requirement(MODULE_IDS.BOOKKEEPING), getTrialBalance: requirement(MODULE_IDS.BOOKKEEPING), getGeneralLedger: requirement(MODULE_IDS.BOOKKEEPING), getFinanceLedgerHealth: requirement(MODULE_IDS.BOOKKEEPING),
  previewFinanceLedgerBackfill: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), runFinanceLedgerBackfill: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE),
  previewReconciliation: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), createReconciliationCase: any(requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE), requirement(MODULE_IDS.INVENTORY, ACCESS_LEVELS.OPERATE)),
  getReconciliationCases: requirement(MODULE_IDS.BOOKKEEPING), getReconciliationBySource: requirement(MODULE_IDS.BOOKKEEPING), approveReconciliationCase: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), rejectReconciliationCase: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.MANAGE), archiveSale: requirement(MODULE_IDS.BOOKKEEPING, ACCESS_LEVELS.OPERATE),

  getSalesByPaymentMethod: requirement(MODULE_IDS.REPORTS), getTotalSales: requirement(MODULE_IDS.REPORTS), getAverageTransactionValue: requirement(MODULE_IDS.REPORTS), getSalesByCategory: requirement(MODULE_IDS.REPORTS), getTopSellingItems: requirement(MODULE_IDS.REPORTS), getGrossProfitMargin: requirement(MODULE_IDS.REPORTS), getTotalSalesRevenueAndProfit: requirement(MODULE_IDS.REPORTS), getTopCustomers: requirement(MODULE_IDS.REPORTS),
  getSalesMetricsReport: requirement(MODULE_IDS.REPORTS), getExpensesReport: requirement(MODULE_IDS.REPORTS), getDailySalesReport: requirement(MODULE_IDS.REPORTS), getTransactionMetricsReport: requirement(MODULE_IDS.REPORTS),
  getMonthlySalesData: requirement(MODULE_IDS.REPORTS), getWeeklySalesGrowth: requirement(MODULE_IDS.REPORTS), getAverageOrderValue: requirement(MODULE_IDS.REPORTS), getWeeklySalesBarData: requirement(MODULE_IDS.REPORTS), getTopPerformingProducts: requirement(MODULE_IDS.REPORTS), getWeeklyGrossMargin: requirement(MODULE_IDS.REPORTS), getGrowthMetrics: requirement(MODULE_IDS.REPORTS), getWeeklyStockoutRate: requirement(MODULE_IDS.REPORTS), getMonthlyStockoutRate: requirement(MODULE_IDS.REPORTS), getHourlySalesData: requirement(MODULE_IDS.REPORTS), transactionMetrics: requirement(MODULE_IDS.REPORTS),
  getTodaysSalesMetrics: requirement(MODULE_IDS.REPORTS), getTodaysExpenses: requirement(MODULE_IDS.REPORTS),

  getAllSubscriptions: requirement(MODULE_IDS.ADEEGO_PLUS), getTodayDeliveries: requirement(MODULE_IDS.ADEEGO_PLUS), getSubscriptionById: requirement(MODULE_IDS.ADEEGO_PLUS), getCustomerSubscriptions: requirement(MODULE_IDS.ADEEGO_PLUS), getDeliveryHistory: requirement(MODULE_IDS.ADEEGO_PLUS), getSubscriptionStats: requirement(MODULE_IDS.ADEEGO_PLUS), searchSubscriptions: requirement(MODULE_IDS.ADEEGO_PLUS),
  updateDeliveryStatus: requirement(MODULE_IDS.ADEEGO_PLUS, ACCESS_LEVELS.OPERATE), addSubscription: requirement(MODULE_IDS.ADEEGO_PLUS, ACCESS_LEVELS.MANAGE), updateSubscription: requirement(MODULE_IDS.ADEEGO_PLUS, ACCESS_LEVELS.MANAGE), deleteSubscription: requirement(MODULE_IDS.ADEEGO_PLUS, ACCESS_LEVELS.MANAGE),

  getAllStaff: requirement(MODULE_IDS.STAFF_ADMIN), getStaffById: requirement(MODULE_IDS.STAFF_ADMIN), createStaff: requirement(MODULE_IDS.STAFF_ADMIN, ACCESS_LEVELS.OPERATE), updateStaff: requirement(MODULE_IDS.STAFF_ADMIN, ACCESS_LEVELS.OPERATE), archiveStaff: requirement(MODULE_IDS.STAFF_ADMIN, ACCESS_LEVELS.OPERATE),
  updateWholeSaler: { owner: true }, deleteWholeSaler: { owner: true }, getWholeSalerById: requirement(MODULE_IDS.STAFF_ADMIN), getAllWholeSalers: requirement(MODULE_IDS.STAFF_ADMIN),
  createWholeSaler: { owner: true },
  createReminder: authenticated, getMyReminders: authenticated, updateReminder: authenticated, completeReminder: authenticated, archiveReminder: authenticated, snoozeReminder: authenticated,
});

function normalizeRole(role) { const key = String(role || '').trim().toLowerCase().replace(/-/g, '_'); return ROLE_ALIASES[key] || null; }
function normalizeRoles(input) { const raw = Array.isArray(input) ? input : String(input || '').split(','); return [...new Set(raw.map((role) => normalizeRole(String(role).trim())).filter(Boolean))]; }
function getStaffRoles(staff) { if (!staff) return []; const roles = normalizeRoles(staff.roles); return roles.length > 0 ? roles : normalizeRoles(staff.role); }
function getPrimaryRole(input) { const roles = Array.isArray(input) ? normalizeRoles(input) : getStaffRoles(input); return ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0] || ''; }
function getRoleLabel(role) { const normalized = normalizeRole(role) || role; return ROLE_LABELS[normalized] || String(role || ''); }
function getRoleLabels(staff) { if (Number(staff?.accessVersion) >= ACCESS_VERSION) return [staff.isOwner ? 'Owner' : (ACCESS_PRESETS[staff.accessPreset]?.label || 'Custom Access')]; return getStaffRoles(staff).map(getRoleLabel); }

function normalizeStaff(staff) {
  if (!staff) return staff;
  const roles = getStaffRoles(staff); const primaryRole = getPrimaryRole(roles); const isV2 = Number(staff.accessVersion) >= ACCESS_VERSION;
  const moduleAccess = isV2 ? normalizeModuleAccess(staff.moduleAccess) : mapLegacyRolesToAccess(roles, { isOwner: staff.isOwner });
  return { ...staff, roles, role: primaryRole ? ROLE_LABELS[primaryRole] : (staff.role || ''), accessPreset: staff.isOwner ? 'owner' : (staff.accessPreset || inferPresetFromLegacyRoles(roles)), moduleAccess: staff.isOwner ? getPresetAccess('owner') : moduleAccess };
}

function hasRole(staff, role) { const normalized = normalizeRole(role); return Boolean(normalized && getStaffRoles(staff).includes(normalized)); }
function can(staff, permission) { return satisfiesRequirement(staff, PERMISSION_REQUIREMENTS[permission]); }
function canAny(staff, permissions) { return permissions.some((permission) => can(staff, permission)); }
function normalizePath(pathname) { return String(pathname || '/').split('?')[0].split('#')[0] || '/'; }
function matchesRoute(pathname, rule) { return rule.prefix ? pathname === rule.pattern || pathname.startsWith(`${rule.pattern}/`) : pathname === rule.pattern; }
function canAccessRoute(staff, pathname) { const rule = ROUTE_RULES.find((entry) => matchesRoute(normalizePath(pathname), entry)); return rule ? satisfiesRequirement(staff, rule.requirement) : Boolean(staff?.isOwner); }
function getDefaultRoute(staff) { return isAuthenticated(staff) ? '/home' : '/auth/login'; }
function getUiSections(staff) { return MODULE_OPTIONS.filter((module) => hasModuleLevel(staff, module.id)).map((module) => ({ ...module, key: module.id, name: module.label, links: module.links.filter((link) => (!link.ownerOnly || staff.isOwner) && hasModuleLevel(staff, module.id, link.level)) })).filter((module) => module.links.length > 0); }
function getNavigationGroups(staff) { return getUiSections(staff); }
function getRoleHomeSections(staff) { return getUiSections(staff).map((section) => ({ ...section, links: section.links.slice(0, 6) })); }
function isAuthenticated(staff) { return Boolean(staff?._id && staff?.state !== 'Inactive'); }
function canPerformOperation(staff, operation) { return isAuthenticated(staff) && satisfiesRequirement(staff, OPERATION_REQUIREMENTS[operation]); }
function isOperationAllowed(staff, operation) { return canPerformOperation(staff, operation); }
function isMessageTaskAllowed(staff, task) { if (!isAuthenticated(staff)) return false; return task === 'getAllMessages' ? can(staff, 'message:read') : can(staff, 'message:write'); }

module.exports = {
  ACCESS_VERSION, ACCESS_LEVELS, MODULE_IDS, MODULE_REGISTRY, MODULE_OPTIONS, ACCESS_PRESETS, PRESET_OPTIONS,
  ROLES, ROLE_LABELS, ROLE_OPTIONS, ROUTE_RULES, OPERATION_REQUIREMENTS, PERMISSION_REQUIREMENTS,
  normalizeRole, normalizeRoles, normalizeStaff, normalizeModuleAccess, getStaffRoles, getPrimaryRole, getRoleLabel, getRoleLabels,
  hasRole, can, canAny, hasModuleLevel, getEffectiveModuleAccess, canAccessRoute, getDefaultRoute, getUiSections,
  getRoleHomeSections, getNavigationGroups, isAuthenticated, canPerformOperation, isOperationAllowed, isMessageTaskAllowed,
};
