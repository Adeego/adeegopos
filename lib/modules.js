const ACCESS_VERSION = 2;

const ACCESS_LEVELS = Object.freeze({
  NONE: 'none',
  VIEW: 'view',
  OPERATE: 'operate',
  MANAGE: 'manage',
});

const ACCESS_LEVEL_ORDER = Object.freeze({
  [ACCESS_LEVELS.NONE]: 0,
  [ACCESS_LEVELS.VIEW]: 1,
  [ACCESS_LEVELS.OPERATE]: 2,
  [ACCESS_LEVELS.MANAGE]: 3,
});

const MODULE_IDS = Object.freeze({
  POS: 'pos',
  CUSTOMERS: 'customers',
  INVENTORY: 'inventory',
  SUPPLIERS: 'suppliers',
  BOOKKEEPING: 'bookkeeping',
  REPORTS: 'reports',
  STAFF_ADMIN: 'staff_admin',
  ADEEGO_PLUS: 'adeego_plus',
});

const MODULE_REGISTRY = Object.freeze({
  [MODULE_IDS.POS]: {
    id: MODULE_IDS.POS,
    label: 'POS',
    description: 'Sell products, review sales, confirm payments, and balance registers.',
    icon: 'shoppingCart',
    order: 10,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: ['Product, variant, and customer lookup'],
    links: [
      { label: 'New Sale', icon: 'shoppingCart', pageLink: '/', level: ACCESS_LEVELS.OPERATE },
      { label: 'Sales History', icon: 'history', pageLink: '/pos/salesHistory', level: ACCESS_LEVELS.VIEW },
      { label: 'Cashier & Register', icon: 'receipt', pageLink: '/cashier/sales', level: ACCESS_LEVELS.MANAGE },
    ],
  },
  [MODULE_IDS.CUSTOMERS]: {
    id: MODULE_IDS.CUSTOMERS,
    label: 'Customers',
    description: 'Manage customer records, history, balances, credit, and ledgers.',
    icon: 'usersRound',
    order: 20,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: [],
    links: [
      { label: 'Customers', icon: 'usersRound', pageLink: '/customers', level: ACCESS_LEVELS.VIEW },
      { label: 'Credit Management', icon: 'badgeDollarSign', pageLink: '/customers/manageCredit', level: ACCESS_LEVELS.MANAGE },
    ],
  },
  [MODULE_IDS.INVENTORY]: {
    id: MODULE_IDS.INVENTORY,
    label: 'Inventory',
    description: 'Manage products, stock, manual replenishment, audits, and batches.',
    icon: 'package',
    order: 30,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: ['Supplier lookup for replenishment'],
    links: [
      { label: 'Products', icon: 'shoppingBag', pageLink: '/product', level: ACCESS_LEVELS.VIEW },
      { label: 'Stock Dashboard', icon: 'package', pageLink: '/stock', level: ACCESS_LEVELS.VIEW },
      { label: 'Restock', icon: 'refreshCw', pageLink: '/product/restock', level: ACCESS_LEVELS.OPERATE },
      { label: 'Stock Audit', icon: 'clipboardCheck', pageLink: '/stock/audit', level: ACCESS_LEVELS.OPERATE },
    ],
  },
  [MODULE_IDS.SUPPLIERS]: {
    id: MODULE_IDS.SUPPLIERS,
    label: 'Suppliers',
    description: 'Manage suppliers, purchasing invoices, payments, and statements.',
    icon: 'cable',
    order: 40,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: ['Product lookup for purchase invoice lines'],
    links: [
      { label: 'Suppliers', icon: 'cable', pageLink: '/supplier', level: ACCESS_LEVELS.VIEW },
      { label: 'Supplier Invoices', icon: 'fileText', pageLink: '/supplier/invoices', level: ACCESS_LEVELS.OPERATE },
    ],
  },
  [MODULE_IDS.BOOKKEEPING]: {
    id: MODULE_IDS.BOOKKEEPING,
    label: 'Bookkeeping',
    description: 'Track accounts, transactions, expenses, journals, and reconciliation.',
    icon: 'landmark',
    order: 50,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: ['Referenced customers, suppliers, invoices, sales, and accounts'],
    links: [
      { label: 'Cashier & Register', icon: 'receipt', pageLink: '/cashier/sales', level: ACCESS_LEVELS.MANAGE },
      { label: 'Finance Overview', icon: 'badgeDollarSign', pageLink: '/finance', level: ACCESS_LEVELS.VIEW },
      { label: 'Accounts', icon: 'landmark', pageLink: '/finance?view=accounts', route: '/finance', level: ACCESS_LEVELS.VIEW },
      { label: 'Transactions', icon: 'badgeDollarSign', pageLink: '/finance?view=transactions', route: '/finance', level: ACCESS_LEVELS.VIEW },
      { label: 'Expenses', icon: 'walletCards', pageLink: '/finance?view=expenses', route: '/finance', level: ACCESS_LEVELS.VIEW },
      { label: 'Ledger', icon: 'fileText', pageLink: '/finance?view=ledger', route: '/finance', level: ACCESS_LEVELS.VIEW },
      { label: 'Reconciliation', icon: 'arrowRightLeft', pageLink: '/reconciliation', level: ACCESS_LEVELS.VIEW },
    ],
  },
  [MODULE_IDS.REPORTS]: {
    id: MODULE_IDS.REPORTS,
    label: 'Reports',
    description: 'Review dashboards, business performance, growth, and analytics.',
    icon: 'chartLine',
    order: 60,
    levels: [ACCESS_LEVELS.VIEW],
    dependencies: [],
    links: [
      { label: 'Dashboard', icon: 'home', pageLink: '/dashboard', level: ACCESS_LEVELS.VIEW },
      { label: 'Performance Reports', icon: 'chartLine', pageLink: '/report', level: ACCESS_LEVELS.VIEW },
      { label: 'Growth', icon: 'trendingUp', pageLink: '/growth', level: ACCESS_LEVELS.VIEW },
    ],
  },
  [MODULE_IDS.STAFF_ADMIN]: {
    id: MODULE_IDS.STAFF_ADMIN,
    label: 'Staff / Admin',
    description: 'Manage staff, access assignments, store settings, billing, and support.',
    icon: 'shieldCheck',
    order: 70,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: [],
    links: [
      { label: 'Staff', icon: 'briefcaseBusiness', pageLink: '/staff', level: ACCESS_LEVELS.VIEW },
      { label: 'Store Settings', icon: 'store', pageLink: '/productStore', level: ACCESS_LEVELS.MANAGE, ownerOnly: true },
      { label: 'App Subscription', icon: 'calendarClock', pageLink: '/adeegoPos/subscription', level: ACCESS_LEVELS.MANAGE, ownerOnly: true },
      { label: 'Support', icon: 'messageCircle', pageLink: '/adeegoPos/support', level: ACCESS_LEVELS.VIEW },
    ],
  },
  [MODULE_IDS.ADEEGO_PLUS]: {
    id: MODULE_IDS.ADEEGO_PLUS,
    label: 'Adeego Plus',
    description: 'Manage customer subscriptions, deliveries, and recurring service.',
    icon: 'calendarClock',
    order: 80,
    levels: [ACCESS_LEVELS.VIEW, ACCESS_LEVELS.OPERATE, ACCESS_LEVELS.MANAGE],
    dependencies: ['Customer lookup'],
    links: [
      { label: 'Subscriptions & Deliveries', icon: 'calendarClock', pageLink: '/adeegoplus', level: ACCESS_LEVELS.VIEW },
    ],
  },
});

const MODULE_OPTIONS = Object.values(MODULE_REGISTRY).sort((a, b) => a.order - b.order);

const ACCESS_PRESETS = Object.freeze({
  seller: {
    id: 'seller',
    label: 'Seller',
    moduleAccess: { [MODULE_IDS.POS]: ACCESS_LEVELS.OPERATE },
  },
  cashier: {
    id: 'cashier',
    label: 'Cashier',
    moduleAccess: { [MODULE_IDS.POS]: ACCESS_LEVELS.MANAGE },
  },
  stock_manager: {
    id: 'stock_manager',
    label: 'Stock Manager',
    moduleAccess: {
      [MODULE_IDS.INVENTORY]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.SUPPLIERS]: ACCESS_LEVELS.OPERATE,
    },
  },
  bookkeeper: {
    id: 'bookkeeper',
    label: 'Bookkeeper',
    moduleAccess: {
      [MODULE_IDS.BOOKKEEPING]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.CUSTOMERS]: ACCESS_LEVELS.VIEW,
      [MODULE_IDS.SUPPLIERS]: ACCESS_LEVELS.VIEW,
      [MODULE_IDS.REPORTS]: ACCESS_LEVELS.VIEW,
    },
  },
  manager: {
    id: 'manager',
    label: 'Manager',
    moduleAccess: {
      [MODULE_IDS.POS]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.CUSTOMERS]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.INVENTORY]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.SUPPLIERS]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.BOOKKEEPING]: ACCESS_LEVELS.MANAGE,
      [MODULE_IDS.REPORTS]: ACCESS_LEVELS.VIEW,
      [MODULE_IDS.STAFF_ADMIN]: ACCESS_LEVELS.OPERATE,
      [MODULE_IDS.ADEEGO_PLUS]: ACCESS_LEVELS.MANAGE,
    },
  },
  owner: {
    id: 'owner',
    label: 'Owner',
    moduleAccess: Object.fromEntries(MODULE_OPTIONS.map((module) => [module.id, module.levels.at(-1)])),
  },
});

const PRESET_OPTIONS = Object.values(ACCESS_PRESETS);

const LEGACY_ROLE_PRESETS = Object.freeze({
  admin: 'manager',
  operator: 'manager',
  seller: 'seller',
  worker: 'seller',
  cashier: 'cashier',
  stock_manager: 'stock_manager',
  bookkeeper: 'bookkeeper',
});

function normalizeAccessLevel(level) {
  const normalized = String(level || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ACCESS_LEVEL_ORDER, normalized)
    ? normalized
    : ACCESS_LEVELS.NONE;
}

function levelAtLeast(actual, required) {
  return ACCESS_LEVEL_ORDER[normalizeAccessLevel(actual)] >= ACCESS_LEVEL_ORDER[normalizeAccessLevel(required)];
}

function normalizeModuleAccess(input = {}) {
  return MODULE_OPTIONS.reduce((access, module) => {
    const requested = normalizeAccessLevel(input?.[module.id]);
    if (requested !== ACCESS_LEVELS.NONE && module.levels.includes(requested)) {
      access[module.id] = requested;
    } else if (requested !== ACCESS_LEVELS.NONE) {
      const allowed = module.levels.filter((level) => levelAtLeast(requested, level));
      if (allowed.length > 0) access[module.id] = allowed.at(-1);
    }
    return access;
  }, {});
}

function mergeModuleAccess(...grants) {
  const merged = {};
  for (const grant of grants) {
    for (const [moduleId, level] of Object.entries(normalizeModuleAccess(grant))) {
      if (!merged[moduleId] || levelAtLeast(level, merged[moduleId])) merged[moduleId] = level;
    }
  }
  return merged;
}

function getPresetAccess(presetId) {
  return normalizeModuleAccess(ACCESS_PRESETS[presetId]?.moduleAccess || {});
}

function mapLegacyRolesToAccess(roles = [], { isOwner = false } = {}) {
  if (isOwner) return getPresetAccess('owner');
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  return mergeModuleAccess(...normalizedRoles.map((role) => {
    const key = String(role || '').trim().toLowerCase().replace(/[ -]/g, '_');
    return getPresetAccess(LEGACY_ROLE_PRESETS[key]);
  }));
}

function inferPresetFromLegacyRoles(roles = [], isOwner = false) {
  if (isOwner) return 'owner';
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  if (normalizedRoles.length !== 1) return 'custom';
  const key = String(normalizedRoles[0] || '').trim().toLowerCase().replace(/[ -]/g, '_');
  return LEGACY_ROLE_PRESETS[key] || 'custom';
}

function getEffectiveModuleAccess(staff) {
  if (!staff) return {};
  if (staff.isOwner) return getPresetAccess('owner');
  if (Number(staff.accessVersion) >= ACCESS_VERSION) return normalizeModuleAccess(staff.moduleAccess);
  const roles = Array.isArray(staff.roles) && staff.roles.length > 0 ? staff.roles : [staff.role];
  return mapLegacyRolesToAccess(roles);
}

function hasModuleLevel(staff, moduleId, requiredLevel = ACCESS_LEVELS.VIEW) {
  if (!MODULE_REGISTRY[moduleId]) return false;
  return levelAtLeast(getEffectiveModuleAccess(staff)[moduleId], requiredLevel);
}

function satisfiesRequirement(staff, requirement) {
  if (!requirement) return false;
  if (requirement.authenticated) return Boolean(staff?._id && staff?.state !== 'Inactive');
  if (requirement.owner) return Boolean(staff?.isOwner);
  if (requirement.any) return requirement.any.some((entry) => satisfiesRequirement(staff, entry));
  if (requirement.all) return requirement.all.every((entry) => satisfiesRequirement(staff, entry));
  return hasModuleLevel(staff, requirement.module, requirement.level);
}

module.exports = {
  ACCESS_VERSION,
  ACCESS_LEVELS,
  ACCESS_LEVEL_ORDER,
  MODULE_IDS,
  MODULE_REGISTRY,
  MODULE_OPTIONS,
  ACCESS_PRESETS,
  PRESET_OPTIONS,
  LEGACY_ROLE_PRESETS,
  normalizeAccessLevel,
  levelAtLeast,
  normalizeModuleAccess,
  mergeModuleAccess,
  getPresetAccess,
  mapLegacyRolesToAccess,
  inferPresetFromLegacyRoles,
  getEffectiveModuleAccess,
  hasModuleLevel,
  satisfiesRequirement,
};
