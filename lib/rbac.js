const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  SELLER: 'seller',
  CASHIER: 'cashier',
  STOCK_MANAGER: 'stock_manager',
  BOOKKEEPER: 'bookkeeper',
};

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.OPERATOR]: 'Operator',
  [ROLES.SELLER]: 'Seller',
  [ROLES.CASHIER]: 'Cashier',
  [ROLES.STOCK_MANAGER]: 'Stock Manager',
  [ROLES.BOOKKEEPER]: 'Bookkeeper',
};

const ROLE_OPTIONS = Object.values(ROLES).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

const ROLE_ALIASES = {
  admin: ROLES.ADMIN,
  administrator: ROLES.ADMIN,
  operator: ROLES.OPERATOR,
  manager: ROLES.OPERATOR,
  worker: ROLES.SELLER,
  seller: ROLES.SELLER,
  salesperson: ROLES.SELLER,
  cashier: ROLES.CASHIER,
  stock_manager: ROLES.STOCK_MANAGER,
  stockmanager: ROLES.STOCK_MANAGER,
  'stock manager': ROLES.STOCK_MANAGER,
  bookkeeper: ROLES.BOOKKEEPER,
  accountant: ROLES.BOOKKEEPER,
};

const ROLE_PRIORITY = [
  ROLES.ADMIN,
  ROLES.OPERATOR,
  ROLES.BOOKKEEPER,
  ROLES.STOCK_MANAGER,
  ROLES.CASHIER,
  ROLES.SELLER,
];

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.OPERATOR]: [
    'assistant:use',
    'cashier:manage',
    'customer:read',
    'customer:write',
    'customer:credit',
    'finance:read',
    'finance:write',
    'growth:read',
    'message:read',
    'message:write',
    'pos:sell',
    'product:read',
    'product:write',
    'reconciliation:approve',
    'reconciliation:create',
    'reconciliation:read',
    'report:read',
    'staff:read',
    'stock:manage',
    'subscription:manage',
    'supplier:manage',
  ],
  [ROLES.SELLER]: [
    'customer:read',
    'pos:sell',
    'product:read',
  ],
  [ROLES.CASHIER]: [
    'assistant:use',
    'cashier:manage',
    'customer:read',
    'pos:sell',
    'product:read',
    'sale:confirmPayment',
    'transaction:read',
  ],
  [ROLES.STOCK_MANAGER]: [
    'product:read',
    'product:write',
    'reconciliation:create',
    'reconciliation:read',
    'stock:manage',
    'supplier:invoice',
  ],
  [ROLES.BOOKKEEPER]: [
    'customer:credit',
    'finance:read',
    'finance:write',
    'report:read',
    'reconciliation:create',
    'reconciliation:read',
    'supplier:invoice',
    'transaction:read',
  ],
};

const DEFAULT_ROUTES = {
  [ROLES.ADMIN]: '/home',
  [ROLES.OPERATOR]: '/home',
  [ROLES.BOOKKEEPER]: '/home',
  [ROLES.STOCK_MANAGER]: '/home',
  [ROLES.CASHIER]: '/home',
  [ROLES.SELLER]: '/home',
};

const UI_SECTIONS = [
  {
    key: 'sales_floor',
    label: 'Sales Floor',
    description: 'Sell, serve customers, and look up product information.',
    icon: 'shoppingCart',
    order: 10,
    allowedRoles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.SELLER, ROLES.CASHIER],
    primaryRoles: [ROLES.SELLER],
    links: [
      { label: 'New Sale', icon: 'shoppingCart', pageLink: '/', permission: 'pos:sell' },
      { label: 'Products', icon: 'shoppingBag', pageLink: '/product', permission: 'product:read' },
      { label: 'Customers', icon: 'usersRound', pageLink: '/customers', permission: 'customer:read' },
      { label: 'Sales History', icon: 'history', pageLink: '/pos/salesHistory', permission: 'pos:sell' },
    ],
  },
  {
    key: 'cash_desk',
    label: 'Cash Desk',
    description: 'Confirm payments, close the register, and review cash movement.',
    icon: 'dollarSign',
    order: 20,
    allowedRoles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.CASHIER],
    primaryRoles: [ROLES.CASHIER],
    links: [
      { label: 'Cashier Sales', icon: 'receipt', pageLink: '/cashier/sales', permission: 'cashier:manage' },
      { label: 'Unpaid Sales', icon: 'alertCircle', pageLink: '/cashier/sales?tab=before', route: '/cashier/sales', permission: 'cashier:manage' },
      { label: 'Register Balancing', icon: 'calculator', pageLink: '/cashier/sales?balance=1', route: '/cashier/sales', permission: 'cashier:manage' },
      { label: 'Transactions', icon: 'badgeDollarSign', pageLink: '/transactions', permission: 'transaction:read' },
      { label: 'Reconciliation', icon: 'arrowRightLeft', pageLink: '/reconciliation', permission: 'reconciliation:read' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Manage stock, replenishment, audits, and incoming supplier invoices.',
    icon: 'package',
    order: 30,
    allowedRoles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.STOCK_MANAGER],
    primaryRoles: [ROLES.STOCK_MANAGER],
    links: [
      { label: 'Stock Dashboard', icon: 'package', pageLink: '/stock', permission: 'stock:manage' },
      { label: 'Stock AI Command', icon: 'bot', pageLink: '/stock/ai-command-center', permission: 'stock:manage' },
      { label: 'Restock', icon: 'refreshCw', pageLink: '/product/restock', permission: 'stock:manage' },
      { label: 'Restock List', icon: 'fileText', pageLink: '/stock/restock-list', permission: 'stock:manage' },
      { label: 'Stock Audit', icon: 'clipboardCheck', pageLink: '/stock/audit', permission: 'stock:manage' },
      { label: 'Supplier Invoices', icon: 'fileText', pageLink: '/invoices', permission: 'supplier:invoice' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    description: 'Track accounts, expenses, reports, and financial position.',
    icon: 'badgeDollarSign',
    order: 40,
    allowedRoles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.BOOKKEEPER],
    primaryRoles: [ROLES.BOOKKEEPER],
    links: [
      { label: 'Finance Overview', icon: 'badgeDollarSign', pageLink: '/finance', permission: 'finance:read' },
      { label: 'Accounts', icon: 'landmark', pageLink: '/finance?view=accounts', route: '/finance', permission: 'finance:read' },
      { label: 'Transactions', icon: 'badgeDollarSign', pageLink: '/finance?view=transactions', route: '/finance', permission: 'transaction:read' },
      { label: 'Expenses', icon: 'walletCards', pageLink: '/finance?view=expenses', route: '/finance', permission: 'finance:read' },
      { label: 'Reports', icon: 'chartLine', pageLink: '/finance?view=reports', route: '/finance', permission: 'report:read' },
      { label: 'Supplier Invoices', icon: 'fileText', pageLink: '/finance?view=invoices', route: '/finance', permission: 'supplier:invoice' },
      { label: 'Reconciliation', icon: 'arrowRightLeft', pageLink: '/finance?view=reconciliation', route: '/finance', permission: 'reconciliation:read' },
    ],
  },
  {
    key: 'store_management',
    label: 'Store Management',
    description: 'Monitor performance, subscriptions, suppliers, and growth.',
    icon: 'settings',
    order: 50,
    allowedRoles: [ROLES.ADMIN, ROLES.OPERATOR],
    primaryRoles: [ROLES.OPERATOR],
    links: [
      { label: 'Dashboard', icon: 'home', pageLink: '/dashboard', roles: [ROLES.ADMIN, ROLES.OPERATOR] },
      { label: 'Adeego Plus', icon: 'calendarClock', pageLink: '/adeegoplus', permission: 'subscription:manage' },
      { label: 'Suppliers', icon: 'cable', pageLink: '/supplier', permission: 'supplier:manage' },
      { label: 'Growth', icon: 'trendingUp', pageLink: '/growth', permission: 'growth:read' },
      { label: 'Performance Reports', icon: 'chartLine', pageLink: '/report', permission: 'report:read' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    description: 'Manage staff, store settings, and workspace controls.',
    icon: 'shieldCheck',
    order: 60,
    allowedRoles: [ROLES.ADMIN],
    primaryRoles: [ROLES.ADMIN],
    links: [
      { label: 'Staff', icon: 'briefcaseBusiness', pageLink: '/staff', roles: [ROLES.ADMIN] },
      { label: 'Store Settings', icon: 'store', pageLink: '/productStore', roles: [ROLES.ADMIN] },
      { label: 'Subscription', icon: 'calendarClock', pageLink: '/adeegoPos/subscription', roles: [ROLES.ADMIN] },
      { label: 'Support', icon: 'messageCircle', pageLink: '/adeegoPos/support', roles: [ROLES.ADMIN] },
    ],
  },
];

const NAVIGATION_GROUPS = UI_SECTIONS;

const ROUTE_RULES = [
  { pattern: '/', permissions: ['pos:sell'] },
  { pattern: '/auth/logout', roles: Object.values(ROLES) },
  { pattern: '/dashboard', roles: [ROLES.ADMIN, ROLES.OPERATOR] },
  { pattern: '/home', roles: Object.values(ROLES) },
  { pattern: '/adeegoPos', roles: Object.values(ROLES), prefix: true },
  { pattern: '/adeegoplus', permissions: ['subscription:manage'] },
  { pattern: '/productStore', roles: [ROLES.ADMIN] },
  { pattern: '/product/restock', permissions: ['stock:manage'] },
  { pattern: '/product', permissions: ['product:read'], prefix: true },
  { pattern: '/stock', permissions: ['stock:manage'], prefix: true },
  { pattern: '/customers/manageCredit', permissions: ['customer:credit'] },
  { pattern: '/customers', permissions: ['customer:read'], prefix: true },
  { pattern: '/cashier/sales', permissions: ['cashier:manage'] },
  { pattern: '/cashier/monthly-pl', roles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.CASHIER, ROLES.BOOKKEEPER] },
  { pattern: '/cashier/balance-sheet', roles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.CASHIER, ROLES.BOOKKEEPER] },
  { pattern: '/transactions', permissions: ['transaction:read'] },
  { pattern: '/finance', permissions: ['finance:read'], prefix: true },
  { pattern: '/supplier/invoices', permissions: ['supplier:invoice'] },
  { pattern: '/supplier', permissions: ['supplier:manage'], prefix: true },
  { pattern: '/invoices', permissions: ['supplier:invoice'] },
  { pattern: '/reconciliation', permissions: ['reconciliation:read'] },
  { pattern: '/report', permissions: ['report:read'] },
  { pattern: '/growth', permissions: ['growth:read'] },
  { pattern: '/staff', roles: [ROLES.ADMIN], prefix: true },
  { pattern: '/pos/salesHistory', permissions: ['pos:sell'] },
  { pattern: '/pos', roles: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.SELLER, ROLES.CASHIER, ROLES.BOOKKEEPER], prefix: true },
];

const OPERATION_PERMISSIONS = {
  getAllCustomers: 'customer:read',
  getCustomerCreditOverview: ['customer:credit', 'finance:read'],
  getCustomerById: 'customer:read',
  getTodayCreditSales: ['customer:credit', 'cashier:manage', 'finance:read'],
  getTodayCustomerTransactions: ['customer:credit', 'cashier:manage', 'finance:read'],
  getCustomerLedger: ['customer:read', 'finance:read'],
  getCustomerAging: ['customer:credit', 'finance:read'],
  createCustomer: 'customer:write',
  updateCustomer: 'customer:write',
  deleteCustomer: 'customer:write',
  getAllProducts: 'product:read',
  getAllVariants: 'product:read',
  getSaleItemsByProductId: ['product:read', 'report:read'],
  getProductById: 'product:read',
  getExpiringProducts: ['product:read', 'stock:manage'],
  addNewProduct: 'product:write',
  updateProduct: 'product:write',
  archiveProduct: 'product:write',
  addNewVariant: 'product:write',
  updateVariant: 'product:write',
  removeVariant: 'product:write',
  removeBatch: 'product:write',
  restockProducts: 'stock:manage',
  createSale: 'pos:sell',
  previewReconciliation: 'reconciliation:create',
  createReconciliationCase: 'reconciliation:create',
  approveReconciliationCase: 'reconciliation:approve',
  rejectReconciliationCase: 'reconciliation:approve',
  getReconciliationCases: 'reconciliation:read',
  getReconciliationBySource: 'reconciliation:read',
  archiveSale: 'reconciliation:create',
  getCashierSales: ['cashier:manage', 'report:read'],
  getTodaySalesByPaidStatus: ['cashier:manage', 'finance:read'],
  getUnpaidSalesBeforeToday: ['cashier:manage', 'finance:read'],
  updateSalePaidStatus: 'sale:confirmPayment',
  createSupplier: 'supplier:manage',
  updateSupplier: 'supplier:manage',
  archiveSupplier: 'supplier:manage',
  createInvoice: 'supplier:invoice',
  getInvoices: 'supplier:invoice',
  getTodayInvoices: 'supplier:invoice',
  getInvoiceById: 'supplier:invoice',
  getTodaySupplierTransactions: 'finance:read',
  getAllSuppliers: ['supplier:manage', 'supplier:invoice', 'finance:read'],
  getSupplierById: ['supplier:manage', 'supplier:invoice', 'finance:read'],
  getSupplierStatement: 'finance:read',
  createAccount: 'finance:write',
  getAllAccounts: 'finance:read',
  getAccountById: 'finance:read',
  updateAccount: 'finance:write',
  archiveAccount: 'finance:write',
  createExpense: 'finance:write',
  getAllExpenses: 'finance:read',
  getExpenseById: 'finance:read',
  updateExpense: 'finance:write',
  archiveExpense: 'finance:write',
  createTransaction: 'finance:write',
  getAllTransactions: 'transaction:read',
  getTodayTransactions: 'transaction:read',
  getTransactionById: 'transaction:read',
  updateTransaction: 'finance:write',
  archiveTransaction: 'finance:write',
  createWholeSaler: 'supplier:manage',
  updateWholeSaler: 'supplier:manage',
  deleteWholeSaler: 'supplier:manage',
  getWholeSalerById: 'supplier:manage',
  getAllWholeSalers: 'supplier:manage',
  createStaff: 'staff:manageRoles',
  updateStaff: 'staff:manageRoles',
  archiveStaff: 'staff:manageRoles',
  getStaffById: 'staff:read',
  getAllStaff: 'staff:read',
  getCustomerSales: ['customer:read', 'finance:read'],
  getSaleProducts: ['product:read', 'finance:read'],
  getSalesByPaymentMethod: ['cashier:manage', 'report:read', 'finance:read'],
  getTotalSales: ['cashier:manage', 'report:read', 'finance:read'],
  getAverageTransactionValue: ['report:read', 'finance:read'],
  getSalesByCategory: ['report:read', 'finance:read'],
  getTopSellingItems: ['report:read', 'finance:read'],
  getGrossProfitMargin: ['report:read', 'finance:read'],
  getTotalSalesRevenueAndProfit: 'report:read',
  getTopCustomers: 'report:read',
  getAllSalesBetweenDates: 'report:read',
  getSaleById: ['pos:sell', 'cashier:manage', 'finance:read', 'report:read'],
  getSalesMetricsReport: 'report:read',
  getExpensesReport: 'report:read',
  getDailySalesReport: 'report:read',
  getTransactionMetricsReport: 'report:read',
  getRegisterSession: 'cashier:manage',
  saveRegisterSession: 'cashier:manage',
  closeRegisterSession: 'cashier:manage',
  incomeStatement: 'finance:read',
  getMonthlyProfitLoss: ['finance:read', 'cashier:manage'],
  getAccountStatement: 'finance:read',
  getBalanceSheet: ['finance:read', 'cashier:manage'],
  getChartOfAccounts: 'finance:read',
  getTrialBalance: 'finance:read',
  createBalanceSheetEntry: 'finance:write',
  getAllBalanceSheets: 'finance:read',
  getBalanceSheetById: 'finance:read',
  archiveBalanceSheet: 'finance:write',
  updateBalanceSheet: 'finance:write',
  createExpenseType: 'finance:write',
  getAllExpenseTypes: 'finance:read',
  getExpenseTypeById: 'finance:read',
  updateExpenseType: 'finance:write',
  archiveExpenseType: 'finance:write',
  printReceipt: 'pos:sell',
  getAllSubscriptions: 'subscription:manage',
  addSubscription: 'subscription:manage',
  updateSubscription: 'subscription:manage',
  deleteSubscription: 'subscription:manage',
  getTodayDeliveries: 'subscription:manage',
  updateDeliveryStatus: 'subscription:manage',
  getSubscriptionById: 'subscription:manage',
  getCustomerSubscriptions: 'subscription:manage',
  getDeliveryHistory: 'subscription:manage',
  getSubscriptionStats: 'subscription:manage',
  searchSubscriptions: 'subscription:manage',
  searchCustomers: 'customer:read',
  getMonthlySalesData: 'growth:read',
  getWeeklySalesGrowth: 'growth:read',
  getAverageOrderValue: 'growth:read',
  getWeeklySalesBarData: 'growth:read',
  getTopPerformingProducts: 'growth:read',
  getWeeklyGrossMargin: 'growth:read',
  getGrowthMetrics: 'growth:read',
  getWeeklyStockoutRate: 'growth:read',
  getMonthlyStockoutRate: 'growth:read',
  createAudit: 'stock:manage',
  submitAudit: 'stock:manage',
  getAudit: 'stock:manage',
  getAuditHistory: 'stock:manage',
  getAuditSummary: 'stock:manage',
  createReminder: Object.values(ROLES),
  getMyReminders: Object.values(ROLES),
  updateReminder: Object.values(ROLES),
  completeReminder: Object.values(ROLES),
  archiveReminder: Object.values(ROLES),
  snoozeReminder: Object.values(ROLES),
};

function normalizeRole(role) {
  const key = String(role || '').trim().toLowerCase().replace(/-/g, '_');
  return ROLE_ALIASES[key] || null;
}

function normalizeRoles(input) {
  const rawRoles = Array.isArray(input)
    ? input
    : String(input || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

  const roles = rawRoles
    .map(normalizeRole)
    .filter(Boolean);

  return [...new Set(roles)];
}

function getStaffRoles(staff) {
  if (!staff) {
    return [];
  }

  const roles = normalizeRoles(staff.roles);
  if (roles.length > 0) {
    return roles;
  }

  return normalizeRoles(staff.role);
}

function normalizeStaff(staff) {
  if (!staff) {
    return staff;
  }

  const roles = getStaffRoles(staff);
  const primaryRole = getPrimaryRole(roles);

  return {
    ...staff,
    roles,
    role: primaryRole ? ROLE_LABELS[primaryRole] : (staff.role || ''),
  };
}

function getPrimaryRole(input) {
  const roles = Array.isArray(input) ? input : getStaffRoles(input);
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0] || '';
}

function getRoleLabel(role) {
  const normalized = normalizeRole(role) || role;
  return ROLE_LABELS[normalized] || String(role || '');
}

function getRoleLabels(staff) {
  return getStaffRoles(staff).map(getRoleLabel);
}

function hasRole(staff, role) {
  const normalized = normalizeRole(role);
  return !!normalized && getStaffRoles(staff).includes(normalized);
}

function can(staff, permission) {
  const roles = getStaffRoles(staff);
  if (roles.length === 0) {
    return false;
  }

  return roles.some((role) => {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  });
}

function canAny(staff, permissions) {
  return permissions.some((permission) => can(staff, permission));
}

function rolesIntersect(staff, roles) {
  const staffRoles = getStaffRoles(staff);
  return roles.some((role) => staffRoles.includes(role));
}

function normalizePath(pathname) {
  return String(pathname || '/').split('?')[0].split('#')[0] || '/';
}

function matchesRoute(pathname, rule) {
  if (rule.prefix) {
    return pathname === rule.pattern || pathname.startsWith(`${rule.pattern}/`);
  }

  return pathname === rule.pattern;
}

function canAccessRoute(staff, pathname) {
  const path = normalizePath(pathname);
  const matchingRule = ROUTE_RULES.find((rule) => matchesRoute(path, rule));

  if (!matchingRule) {
    return hasRole(staff, ROLES.ADMIN) || hasRole(staff, ROLES.OPERATOR);
  }

  if (matchingRule.roles && rolesIntersect(staff, matchingRule.roles)) {
    return true;
  }

  if (matchingRule.permissions) {
    const permissions = Array.isArray(matchingRule.permissions)
      ? matchingRule.permissions
      : [matchingRule.permissions];
    return canAny(staff, permissions);
  }

  return false;
}

function getDefaultRoute(staff) {
  return isAuthenticated(staff) ? '/home' : '/auth/login';
}

function isLinkAllowed(staff, link) {
  if (link.roles && rolesIntersect(staff, link.roles)) {
    return true;
  }

  if (link.permission && can(staff, link.permission)) {
    return true;
  }

  return canAccessRoute(staff, link.route || link.pageLink);
}

function rankSectionForStaff(staff, section) {
  const primaryRole = getPrimaryRole(staff);
  return section.primaryRoles?.includes(primaryRole)
    ? section.order - 1000
    : section.order;
}

function getUiSections(staff) {
  const seenLinks = new Set();

  return UI_SECTIONS
    .filter((group) => rolesIntersect(staff, group.allowedRoles))
    .sort((a, b) => rankSectionForStaff(staff, a) - rankSectionForStaff(staff, b))
    .map((group) => ({
      ...group,
      name: group.label,
      links: group.links.filter((link) => {
        if (!isLinkAllowed(staff, link)) {
          return false;
        }

        const key = link.pageLink;
        if (seenLinks.has(key)) {
          return false;
        }

        seenLinks.add(key);
        return true;
      }),
    }))
    .filter((group) => group.links.length > 0);
}

function getNavigationGroups(staff) {
  return getUiSections(staff);
}

function getRoleHomeSections(staff) {
  return getUiSections(staff).map((section) => ({
    ...section,
    links: section.links.slice(0, 6),
  }));
}

function isAuthenticated(staff) {
  return !!(staff && staff._id);
}

function isAllowedByRule(staff, rule) {
  if (!rule) {
    return hasRole(staff, ROLES.ADMIN) || hasRole(staff, ROLES.OPERATOR);
  }

  const rules = Array.isArray(rule) ? rule : [rule];
  return rules.some((entry) => {
    if (Object.values(ROLES).includes(entry)) {
      return hasRole(staff, entry);
    }
    return can(staff, entry);
  });
}

function isOperationAllowed(staff, operation) {
  if (!isAuthenticated(staff)) {
    return false;
  }

  return isAllowedByRule(staff, OPERATION_PERMISSIONS[operation]);
}

function isRestockTaskAllowed(staff, task) {
  if (!isAuthenticated(staff)) {
    return false;
  }

  if (['getRestockList', 'checkLowStock'].includes(task)) {
    return can(staff, 'product:read') || can(staff, 'stock:manage');
  }

  return can(staff, 'stock:manage');
}

function isMessageTaskAllowed(staff, task) {
  if (!isAuthenticated(staff)) {
    return false;
  }

  if (task === 'getAllMessages') {
    return can(staff, 'message:read') || hasRole(staff, ROLES.ADMIN) || hasRole(staff, ROLES.OPERATOR);
  }

  return can(staff, 'message:write') || hasRole(staff, ROLES.ADMIN) || hasRole(staff, ROLES.OPERATOR);
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  ROLE_OPTIONS,
  NAVIGATION_GROUPS,
  UI_SECTIONS,
  normalizeRole,
  normalizeRoles,
  normalizeStaff,
  getStaffRoles,
  getPrimaryRole,
  getRoleLabel,
  getRoleLabels,
  hasRole,
  can,
  canAny,
  canAccessRoute,
  getDefaultRoute,
  getUiSections,
  getRoleHomeSections,
  getNavigationGroups,
  isAuthenticated,
  isOperationAllowed,
  isRestockTaskAllowed,
  isMessageTaskAllowed,
};
