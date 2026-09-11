const { v4: uuidv4 } = require('uuid');

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoString(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function isConflictError(error = {}) {
  return error.status === 409 || error.name === 'conflict';
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function buildActorReference(actor = {}) {
  if (!actor || typeof actor !== 'object') {
    return null;
  }

  const nameParts = [actor.firstName, actor.lastName].filter(Boolean);

  return {
    id: actor._id || actor.id || null,
    name: actor.name || nameParts.join(' ') || actor.phone || 'Unknown staff',
    role: normalizeRole(actor.role),
  };
}

function dedupeIds(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeSaleItem(item = {}) {
  const quantity = Math.abs(toNumber(item.quantity));
  const unitPrice = toNumber(item.unitPrice);
  const conversionFactor = Math.abs(toNumber(item.conversionFactor)) || 1;
  const providedSubtotal = Number(item.subtotal);
  const subtotal = Number.isFinite(providedSubtotal)
    ? providedSubtotal
    : Number((unitPrice * quantity).toFixed(2));

  return {
    _id: item._id || `${uuidv4()}`,
    productId: item.productId || item.parentProductId || item._productId || null,
    variantId: item.variantId || item.variant_id || null,
    name: item.name || '',
    buyPrice: toNumber(item.buyPrice),
    unitPrice,
    quantity,
    subtotal,
    discount: toNumber(item.discount),
    conversionFactor,
    condition: item.condition || 'sellable',
  };
}

function normalizePaymentMethod(value) {
  const method = String(value || 'CASH').trim();
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'M-PESA' || upperMethod === 'PHONE') {
    return 'MPESA';
  }

  if (['CASH', 'MPESA', 'CREDIT', 'HYBRID'].includes(upperMethod)) {
    return upperMethod;
  }

  return method;
}

function isCreditPaymentMethod(paymentMethod) {
  return normalizePaymentMethod(paymentMethod) === 'CREDIT';
}

function normalizePaymentBreakdown(input = [], totalAmount = 0, fallbackMethod = 'CASH', fallbackTransactionCost = 0) {
  const fallback = normalizePaymentMethod(fallbackMethod);
  const source = Array.isArray(input) && input.length > 0
    ? input
    : [{
        method: fallback,
        amount: Math.abs(toNumber(totalAmount)),
        transactionCost: toNumber(fallbackTransactionCost),
      }];

  return source
    .map((payment) => ({
      method: normalizePaymentMethod(payment.method || payment.paymentMethod),
      amount: Number(Math.abs(toNumber(payment.amount)).toFixed(2)),
      transactionCost: Number(Math.abs(toNumber(payment.transactionCost)).toFixed(2)),
      accountId: payment.accountId || null,
    }))
    .filter((payment) => payment.amount > 0);
}

function getSalePaymentBreakdown(sale = {}) {
  const totalAmount = Math.abs(toNumber(sale.totalAmount));
  const breakdown = normalizePaymentBreakdown(
    sale.paymentBreakdown,
    totalAmount,
    sale.paymentMethod,
    sale.transactionCost
  );

  if (breakdown.length === 0 && totalAmount > 0) {
    return normalizePaymentBreakdown([], totalAmount, sale.paymentMethod, sale.transactionCost);
  }

  return breakdown;
}

function buildSaleDocument(saleData = {}, overrides = {}) {
  const createdAt = toIsoString(saleData.createdAt);
  const updatedAt = toIsoString(saleData.updatedAt || createdAt);
  const items = (saleData.items || []).map(normalizeSaleItem);
  const computedTotalAmount = items.reduce((sum, item) => sum + toNumber(item.subtotal), 0);
  const totalAmount = Number(
    (saleData.totalAmount !== undefined ? toNumber(saleData.totalAmount) : computedTotalAmount).toFixed(2)
  );
  const paymentMethod = normalizePaymentMethod(saleData.paymentMethod || 'CASH');
  const paymentBreakdown = normalizePaymentBreakdown(
    saleData.paymentBreakdown,
    totalAmount,
    paymentMethod,
    saleData.transactionCost
  );
  const transactionCost = saleData.transactionCost !== undefined
    ? toNumber(saleData.transactionCost)
    : paymentBreakdown.reduce((sum, payment) => sum + payment.transactionCost, 0);

  return {
    _id: saleData._id || `${saleData.storeNo || 'store'}:sale:${uuidv4()}`,
    type: 'sale',
    customerId: saleData.customerId || null,
    currentCustomerId: saleData.currentCustomerId || saleData.customerId || null,
    items,
    totalAmount,
    totalItems: Number(saleData.totalItems ?? items.length) || items.length,
    totalDiscount: toNumber(saleData.totalDiscount),
    servedBy: saleData.servedBy || '',
    amountPaid: toNumber(saleData.amountPaid),
    transactionCost: Number(transactionCost.toFixed(2)),
    change: toNumber(saleData.change),
    note: saleData.note || '',
    paymentMethod,
    paymentBreakdown,
    saleType: saleData.saleType || 'NEW SALE',
    fullfilmentType: saleData.fullfilmentType || 'WALK-IN-CLIENT',
    paid: saleData.paid !== undefined ? saleData.paid : false,
    paidAt: saleData.paidAt || null,
    paidBy: saleData.paidBy || null,
    paidRegisterSessionId: saleData.paidRegisterSessionId || null,
    paymentPostingVersion: saleData.paymentPostingVersion || 2,
    confirmed: saleData.confirmed !== undefined ? saleData.confirmed : true,
    storeNo: saleData.storeNo,
    state: saleData.state || 'Active',
    status: saleData.status || 'posted',
    originSaleId: saleData.originSaleId || null,
    replacementOfSaleId: saleData.replacementOfSaleId || null,
    registerSessionId: saleData.registerSessionId || null,
    reconciliationCaseIds: dedupeIds(saleData.reconciliationCaseIds || []),
    reconciliationCaseType: saleData.reconciliationCaseType || null,
    voidedAt: saleData.voidedAt || null,
    voidReasonCode: saleData.voidReasonCode || null,
    returnedQuantitiesByLine: saleData.returnedQuantitiesByLine || {},
    createdAt,
    updatedAt,
    metadata: saleData.metadata || null,
    ...overrides,
  };
}

function buildTransactionDocument(transactionData = {}, overrides = {}) {
  const createdAt = toIsoString(transactionData.createdAt);
  const updatedAt = toIsoString(transactionData.updatedAt || createdAt);

  return {
    _id: transactionData._id || `${transactionData.storeNo || 'store'}:transaction:${uuidv4()}`,
    from: transactionData.from,
    to: transactionData.to,
    source: transactionData.source,
    destination: transactionData.destination,
    description: transactionData.description || '',
    amount: Math.abs(toNumber(transactionData.amount)),
    transactionCost: toNumber(transactionData.transactionCost),
    date: toIsoString(transactionData.date || createdAt),
    transType: transactionData.transType,
    storeNo: transactionData.storeNo,
    type: 'transaction',
    state: transactionData.state || 'Active',
    status: transactionData.status || 'posted',
    reconciliationCaseId: transactionData.reconciliationCaseId || null,
    registerSessionId: transactionData.registerSessionId || null,
    reversalOfId: transactionData.reversalOfId || null,
    replacementOfId: transactionData.replacementOfId || null,
    locked: transactionData.locked !== undefined ? transactionData.locked : true,
    createdAt,
    updatedAt,
    metadata: transactionData.metadata || null,
    ...overrides,
  };
}

function getCurrentCustomerId(sale = {}) {
  return sale.currentCustomerId || sale.customerId || null;
}

function getSaleMetricSign(sale = {}) {
  if (!sale || sale.state !== 'Active') {
    return 0;
  }

  if (sale.status === 'voided' || sale.status === 'failed' || sale.status === 'posting') {
    return 0;
  }

  if (sale.reconciliationCaseType === 'sale_void') {
    return 0;
  }

  return sale.saleType === 'RETURN SALE' ? -1 : 1;
}

function getSaleNetAmount(sale = {}) {
  return Number((Math.abs(toNumber(sale.totalAmount)) * getSaleMetricSign(sale)).toFixed(2));
}

function getSaleNetItemSubtotal(item = {}, sale = {}) {
  return Number((Math.abs(toNumber(item.subtotal)) * getSaleMetricSign(sale)).toFixed(2));
}

function getSaleNetCost(sale = {}) {
  const sign = getSaleMetricSign(sale);
  if (!sign) {
    return 0;
  }

  const totalCost = (sale.items || []).reduce((sum, item) => {
    const quantity = Math.abs(toNumber(item.quantity));
    const buyPrice = toNumber(item.buyPrice);
    return sum + (quantity * buyPrice);
  }, 0);

  return Number((totalCost * sign).toFixed(2));
}

function shouldIncludeSaleInMetrics(sale = {}) {
  return getSaleMetricSign(sale) !== 0;
}

function shouldIncludeTransactionInMetrics(transaction = {}) {
  if (!transaction || transaction.state !== 'Active') {
    return false;
  }

  if (transaction.status === 'reversed') {
    return false;
  }

  if (transaction.reversalOfId) {
    return false;
  }

  return true;
}

const REGISTER_SESSION_REQUIRED_ERROR = 'Open register first before recording cash or M-Pesa cashier movements.';

function isCashierAccount(account = {}) {
  if (!account || account.state !== 'Active') {
    return false;
  }

  const accountNumber = String(account.accountNumber || '');
  const text = `${account.name || ''} ${account.accountNumber || ''}`.toLowerCase();
  const tender = String(account.registerTenderType || '').toUpperCase();
  return account.accountType === 'Cashier' && (
    tender === 'CASH' || tender === 'MPESA' || accountNumber.endsWith('001') || accountNumber.endsWith('002') ||
    text.includes('cash') || text.includes('drawer') || text.includes('mpesa') || text.includes('m-pesa') || text.includes('till')
  );
}

function accountLooksLikePaymentMethod(account = {}, paymentMethod = '') {
  const method = String(paymentMethod || '').trim();
  const normalizedMethod = normalizePaymentMethod(method);
  const accountName = String(account.name || '').trim().toLowerCase();
  const accountNumber = String(account.accountNumber || '');

  if (accountName && method.toLowerCase() === accountName) {
    return true;
  }

  if (normalizedMethod === 'CASH' && accountNumber.endsWith('001')) {
    return true;
  }

  if (normalizedMethod === 'MPESA' && accountNumber.endsWith('002')) {
    return true;
  }

  return false;
}

async function getStoreCashierAccounts(db, storeNo) {
  if (!storeNo) {
    return [];
  }

  const result = await db.find({
    selector: {
      type: 'account',
      state: 'Active',
      storeNo,
    },
    limit: 9999,
  });

  return (result.docs || []).filter(isCashierAccount);
}

async function getOpenRegisterSession(db, storeNo) {
  if (!storeNo) {
    return null;
  }

  const result = await db.find({
    selector: {
      type: 'register-session',
      state: 'Active',
      storeNo,
      status: 'open',
    },
    limit: 9999,
  });

  const openSessions = (result.docs || []).filter((session) => session.openedAt);
  if (openSessions.length > 1) {
    throw new Error('Multiple open register sessions were found. Close one before continuing.');
  }

  return openSessions[0] || null;
}

function actorId(actor = {}) {
  return actor?._id || actor?.id || null;
}

function assertShiftOwner(openSession, actor) {
  const ownerId = openSession?.openedBy?.id || openSession?.openedBy?._id || null;
  const currentActorId = actorId(actor);
  if (!currentActorId || !ownerId || currentActorId !== ownerId) {
    throw new Error('This shift belongs to another cashier. Wait until it is closed.');
  }
}

async function attachOpenRegisterSession(db, doc, options = {}) {
  if (options.skipRegisterSessionRequirement) {
    return doc;
  }

  const openSession = await getOpenRegisterSession(db, doc.storeNo);
  if (!openSession?._id) {
    throw new Error(REGISTER_SESSION_REQUIRED_ERROR);
  }

  if (options.requireShiftOwner === true && options.actor) {
    assertShiftOwner(openSession, options.actor);
  }

  if (doc.registerSessionId && doc.registerSessionId !== openSession._id) {
    throw new Error('This register session is no longer open. Refresh and try again.');
  }

  return {
    ...doc,
    registerSessionId: openSession._id,
    metadata: {
      ...(doc.metadata || {}),
      registerSessionId: openSession._id,
    },
  };
}

async function saleRequiresRegisterSession(db, sale) {
  const cashierAccounts = await getStoreCashierAccounts(db, sale.storeNo);
  const cashierAccountIds = new Set(cashierAccounts.map((account) => account._id));

  for (const payment of getSalePaymentBreakdown(sale)) {
    const amount = Math.abs(toNumber(payment.amount));
    const paymentMethod = normalizePaymentMethod(payment.method);

    if (!amount || isCreditPaymentMethod(paymentMethod)) {
      continue;
    }

    if (payment.accountId && cashierAccountIds.has(payment.accountId)) {
      return true;
    }

    if (!payment.accountId && cashierAccounts.some((account) => accountLooksLikePaymentMethod(account, payment.method))) {
      return true;
    }
  }

  return false;
}

async function attachOpenRegisterSessionToSale(db, sale, options = {}) {
  if (options.skipRegisterSessionRequirement) {
    return sale;
  }

  // Every sale belongs to a shift, including credit and unconfirmed sales. This
  // keeps stock, revenue and unpaid declarations attributable to one cashier.
  // Interactive sale creation may be performed by another POS operator, while
  // workflows such as payment confirmation remain restricted to the cashier.
  const requireShiftOwner = options.requireShiftOwner !== false;
  return attachOpenRegisterSession(db, sale, { ...options, requireShiftOwner });
}

async function attachOpenRegisterSessionForAccount(db, doc, accountId, options = {}) {
  if (options.skipRegisterSessionRequirement || !accountId) {
    return doc;
  }

  let account;
  try {
    account = await db.get(accountId);
  } catch (error) {
    return doc;
  }
  if (doc.storeNo && account.storeNo && String(account.storeNo) !== String(doc.storeNo)) {
    throw new Error('The selected account does not belong to your store.');
  }
  if (!isCashierAccount(account)) return doc;

  return attachOpenRegisterSession(db, doc, options);
}

async function transactionRequiresRegisterSession(db, transaction, options = {}) {
  if (options.skipRegisterSessionRequirement) {
    return false;
  }

  const rows = getTransactionImpactRows(transaction, options);
  const accountIds = dedupeIds(rows
    .filter((row) => row.entityType === 'account' && row.entityId)
    .map((row) => row.entityId));

  for (const accountId of accountIds) {
    let account;
    try {
      account = await db.get(accountId);
    } catch (error) {
      // Validation elsewhere reports missing accounts when they matter.
      continue;
    }
    if (transaction.storeNo && account.storeNo && String(account.storeNo) !== String(transaction.storeNo)) {
      throw new Error('A transaction account does not belong to your store.');
    }
    if (isCashierAccount(account)) {
      return true;
    }
  }

  return false;
}

async function attachOpenRegisterSessionToTransaction(db, transaction, options = {}) {
  if (options.skipRegisterSessionRequirement) {
    return transaction;
  }

  if (!await transactionRequiresRegisterSession(db, transaction, options)) {
    return transaction;
  }

  return attachOpenRegisterSession(db, transaction, options);
}

function sortBatchesByExpiry(batches = []) {
  return [...batches].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });
}

function getBatchQuantityTotal(batches = []) {
  return Number((batches || []).reduce((sum, batch) => sum + Math.max(0, toNumber(batch.quantity)), 0).toFixed(2));
}

function normalizeStockBatches(product = {}) {
  const stock = Math.max(0, toNumber(product.stock));
  const batches = Array.isArray(product.batches) ? [...product.batches] : [];
  const activeBatches = batches
    .map((batch) => ({
      ...batch,
      quantity: Number(Math.max(0, toNumber(batch.quantity)).toFixed(2)),
    }))
    .filter((batch) => toNumber(batch.quantity) > 0);

  const batchTotal = getBatchQuantityTotal(activeBatches);
  if (stock > batchTotal) {
    activeBatches.push({
      batchId: `${product._id || 'product'}:legacy-batch`,
      expiryDate: null,
      quantity: Number((stock - batchTotal).toFixed(2)),
      addedAt: product.createdAt || new Date().toISOString(),
      source: 'legacy-stock-balance',
    });
  } else if (batchTotal > stock) {
    let remainingStock = stock;
    return sortBatchesByExpiry(activeBatches).reduce((normalized, batch) => {
      if (remainingStock <= 0) return normalized;
      const quantity = Number(Math.min(toNumber(batch.quantity), remainingStock).toFixed(2));
      remainingStock = Number((remainingStock - quantity).toFixed(2));
      if (quantity > 0) normalized.push({ ...batch, quantity });
      return normalized;
    }, []);
  }

  return activeBatches;
}

function applyStockDeltaToProduct(product, quantityDelta) {
  let updatedBatches = normalizeStockBatches(product);

  if (quantityDelta < 0) {
    let remaining = Math.abs(quantityDelta);
    updatedBatches = sortBatchesByExpiry(updatedBatches)
      .map((batch) => {
        if (remaining <= 0) {
          return batch;
        }

        const available = Math.abs(toNumber(batch.quantity));
        const deduct = Math.min(available, remaining);
        remaining = Number((remaining - deduct).toFixed(2));

        return {
          ...batch,
          quantity: Number((available - deduct).toFixed(2)),
        };
      })
      .filter((batch) => toNumber(batch.quantity) > 0);

    if (remaining > 0) {
      throw new Error(`Insufficient batch stock for ${product.name}`);
    }
  } else if (quantityDelta > 0) {
    if (updatedBatches.length > 0) {
      const firstBatch = updatedBatches[0];
      updatedBatches[0] = {
        ...firstBatch,
        quantity: Number((toNumber(firstBatch.quantity) + quantityDelta).toFixed(2)),
      };
    } else {
      updatedBatches = [{
        batchId: uuidv4(),
        expiryDate: null,
        quantity: Number(quantityDelta.toFixed(2)),
        addedAt: new Date().toISOString(),
      }];
    }
  }

  const updatedStock = Number((toNumber(product.stock) + quantityDelta).toFixed(2));
  if (updatedStock < 0) {
    throw new Error(`${product.name} has insufficient stock for this action`);
  }

  const wasAboveThreshold = toNumber(product.stock) >= toNumber(product.restockThreshold);
  const isNowBelowThreshold = updatedStock < toNumber(product.restockThreshold);
  const shouldTriggerRestock = quantityDelta < 0 && wasAboveThreshold && isNowBelowThreshold;

  return {
    updatedProduct: {
      ...product,
      stock: updatedStock,
      batches: updatedBatches,
      restock: shouldTriggerRestock || product.restock,
      updatedAt: new Date().toISOString(),
    },
    shouldTriggerRestock,
  };
}

async function findPaymentAccount(db, { storeNo, paymentMethod, accountId }) {
  if (accountId) {
    try {
      const explicitAccount = await db.get(accountId);
      const accountNumber = String(explicitAccount?.accountNumber || '');
      const accountText = `${explicitAccount?.name || ''} ${explicitAccount?.registerTenderType || ''}`.toLowerCase();
      const isRegisterTender = accountNumber === `${storeNo}001`
        || accountNumber === `${storeNo}002`
        || /(^|\s)cash($|\s)|drawer|mpesa|m-pesa|m pesa|till/.test(accountText);
      if (
        explicitAccount &&
        explicitAccount.type === 'account' &&
        explicitAccount.state === 'Active' &&
        isCashierAccount(explicitAccount) &&
        isRegisterTender &&
        (!storeNo || explicitAccount.storeNo === storeNo)
      ) {
        return explicitAccount;
      }
    } catch (error) {
      return null;
    }
  }

  const normalizedMethod = normalizePaymentMethod(paymentMethod);
  const suffix = normalizedMethod === 'CASH' ? '001' : normalizedMethod === 'MPESA' ? '002' : null;
  if (!suffix || !storeNo) {
    return null;
  }

  const result = await db.find({
    selector: {
      type: 'account',
      state: 'Active',
      storeNo,
      accountNumber: `${storeNo}${suffix}`,
    },
    limit: 1,
  });

  return result.docs[0] || null;
}

async function validateSalePaymentAccounts(db, sale) {
  const errors = [];

  for (const payment of getSalePaymentBreakdown(sale)) {
    const amount = Math.abs(toNumber(payment.amount));
    const paymentMethod = normalizePaymentMethod(payment.method);

    if (!amount || isCreditPaymentMethod(paymentMethod)) {
      continue;
    }

    const account = await findPaymentAccount(db, {
      storeNo: sale.storeNo,
      paymentMethod,
      accountId: payment.accountId,
    });

    if (!account?._id) {
      errors.push(`Cashier account is required for ${paymentMethod || 'this payment'}`);
    } else {
      const number = String(account.accountNumber || '');
      const text = `${account.name || ''} ${account.registerTenderType || ''}`.toLowerCase();
      const isCash = number === `${sale.storeNo}001` || /(^|\s)cash($|\s)|drawer/.test(text);
      const isMpesa = number === `${sale.storeNo}002` || /mpesa|m-pesa|m pesa|till/.test(text);
      if (!isCash && !isMpesa) errors.push('Only the store Cash and M-Pesa accounts can receive sale payments');
    }
  }

  return errors;
}

async function applyEntityBalanceDelta(db, entityType, entityId, delta) {
  if (!entityType || !entityId || !delta) {
    return null;
  }

  const doc = await db.get(entityId);
  const nextBalance = Number((toNumber(doc.balance) + toNumber(delta)).toFixed(2));
  const updatedDoc = {
    ...doc,
    balance: nextBalance,
    updatedAt: new Date().toISOString(),
  };

  await db.put(updatedDoc);
  return updatedDoc;
}

function createLedgerEntryDoc(entry = {}) {
  const createdAt = toIsoString(entry.createdAt);
  const delta = toNumber(entry.delta);
  const bucket = entry.bucket || 'account_balance';
  const entryType = delta >= 0 ? 'CREDIT' : 'DEBIT';

  return {
    _id: entry._id || `${entry.storeNo || 'store'}:ledger-entry:${uuidv4()}`,
    type: 'ledger-entry',
    state: 'Active',
    storeNo: entry.storeNo,
    entityType: entry.entityType,
    entityId: entry.entityId,
    bucket,
    delta: Number(delta.toFixed(2)),
    amount: Number(Math.abs(delta).toFixed(2)),
    entryType,
    description: entry.description || '',
    sourceDocType: entry.sourceDocType || null,
    sourceDocId: entry.sourceDocId || null,
    reconciliationCaseId: entry.reconciliationCaseId || null,
    relatedEntityType: entry.relatedEntityType || null,
    relatedEntityId: entry.relatedEntityId || null,
    metadata: entry.metadata || null,
    date: toIsoString(entry.date || createdAt),
    createdAt,
    updatedAt: toIsoString(entry.updatedAt || createdAt),
  };
}

async function recordLedgerEntry(db, entry) {
  const doc = createLedgerEntryDoc(entry);
  await db.put(doc);
  return doc;
}

function createStockMovementDoc(movement = {}) {
  const createdAt = toIsoString(movement.createdAt);

  return {
    _id: movement._id || `${movement.storeNo || 'store'}:stock-movement:${uuidv4()}`,
    type: 'stock-movement',
    state: 'Active',
    storeNo: movement.storeNo,
    productId: movement.productId,
    saleLineId: movement.saleLineId || null,
    lineQuantity: Math.abs(toNumber(movement.lineQuantity)),
    conversionFactor: Math.abs(toNumber(movement.conversionFactor)) || 1,
    quantityDelta: Number(toNumber(movement.quantityDelta).toFixed(2)),
    condition: movement.condition || 'sellable',
    sourceDocType: movement.sourceDocType || null,
    sourceDocId: movement.sourceDocId || null,
    reconciliationCaseId: movement.reconciliationCaseId || null,
    metadata: movement.metadata || null,
    createdAt,
    updatedAt: toIsoString(movement.updatedAt || createdAt),
  };
}

async function recordStockMovement(db, movement) {
  const doc = createStockMovementDoc(movement);
  await db.put(doc);
  return doc;
}

function getSaleBalancePreview(sale = {}, account = null) {
  const customerId = getCurrentCustomerId(sale);
  const isReturn = sale.saleType === 'RETURN SALE';
  const customerDeltas = [];
  const accountDeltas = [];
  const breakdown = getSalePaymentBreakdown(sale);

  if (breakdown.length === 0) {
    return { customerDeltas, accountDeltas };
  }

  for (const payment of breakdown) {
    const amount = Math.abs(toNumber(payment.amount));
    const paymentMethod = normalizePaymentMethod(payment.method);

    if (!amount) {
      continue;
    }

    if (isCreditPaymentMethod(paymentMethod) && customerId) {
      customerDeltas.push({
        entityType: 'customer',
        entityId: customerId,
        delta: Number((isReturn ? amount : -amount).toFixed(2)),
        bucket: 'customer_balance',
        description: isReturn ? 'Credit sale return posted' : 'Credit sale posted',
        paymentMethod,
        amount,
        transactionCost: payment.transactionCost,
      });
    }

    if (!isCreditPaymentMethod(paymentMethod) && account?._id) {
      accountDeltas.push({
        entityType: 'account',
        entityId: account._id,
        delta: Number((isReturn ? -amount : amount).toFixed(2)),
        bucket: 'account_balance',
        description: isReturn ? `Refund issued via ${paymentMethod}` : `Sale settled via ${paymentMethod}`,
        paymentMethod,
        amount,
        transactionCost: payment.transactionCost,
      });
    }
  }

  return { customerDeltas, accountDeltas };
}

async function getSaleBalanceRows(db, sale, options = {}) {
  const customerId = getCurrentCustomerId(sale);
  const isReturn = sale.saleType === 'RETURN SALE';
  const customerDeltas = [];
  const accountDeltas = [];

  for (const payment of getSalePaymentBreakdown(sale)) {
    const paymentMethod = normalizePaymentMethod(payment.method);
    const amount = Math.abs(toNumber(payment.amount));

    if (!amount) {
      continue;
    }

    if (isCreditPaymentMethod(paymentMethod) && customerId) {
      customerDeltas.push({
        entityType: 'customer',
        entityId: customerId,
        delta: Number((isReturn ? amount : -amount).toFixed(2)),
        bucket: 'customer_balance',
        description: isReturn ? 'Credit sale return posted' : 'Credit sale posted',
        paymentMethod,
        amount,
        transactionCost: payment.transactionCost,
      });
      continue;
    }

    const account = await findPaymentAccount(db, {
      storeNo: sale.storeNo,
      paymentMethod,
      accountId: payment.accountId || options.accountId,
    });

    // A selected tender is not proof that money was received. Cash/M-Pesa only
    // become account movements after the sale is explicitly confirmed paid.
    if (!isCreditPaymentMethod(paymentMethod) && sale.paid === true && account?._id) {
      const fee = Math.abs(toNumber(payment.transactionCost));
      const settledDelta = isReturn ? -(amount + fee) : (amount - fee);
      accountDeltas.push({
        entityType: 'account',
        entityId: account._id,
        delta: Number(settledDelta.toFixed(2)),
        bucket: 'account_balance',
        description: isReturn ? `Refund issued via ${paymentMethod}` : `Sale settled via ${paymentMethod}`,
        paymentMethod,
        amount,
        transactionCost: payment.transactionCost,
      });
    }
  }

  return { customerDeltas, accountDeltas };
}

function getTransactionImpactRows(transaction = {}, options = {}) {
  const direction = options.direction === -1 ? -1 : 1;
  const amount = Math.abs(toNumber(transaction.amount));
  const transactionCost = Math.abs(toNumber(transaction.transactionCost));
  const rows = [];

  if (!amount) {
    return rows;
  }

  if (transaction.transType === 'withdraw') {
    if (transaction.source) {
      rows.push({
        entityType: transaction.source,
        entityId: transaction.from,
        delta: Number((-amount * direction).toFixed(2)),
      });
    }

    if (transaction.destination) {
      rows.push({
        entityType: transaction.destination,
        entityId: transaction.to,
        delta: Number(((transaction.destination === 'account' ? amount : -amount) * direction).toFixed(2)),
      });
    }

    if (transactionCost > 0) {
      if (transaction.source === 'account' && transaction.from) {
        rows.push({
          entityType: 'account',
          entityId: transaction.from,
          delta: Number((-transactionCost * direction).toFixed(2)),
        });
      } else if (transaction.destination === 'account' && transaction.to) {
        rows.push({
          entityType: 'account',
          entityId: transaction.to,
          delta: Number((-transactionCost * direction).toFixed(2)),
        });
      }
    }

    return rows;
  }

  if (transaction.transType === 'deposit') {
    if (transaction.source) {
      rows.push({
        entityType: transaction.source,
        entityId: transaction.from,
        delta: Number(((transaction.source === 'account' ? -amount : amount) * direction).toFixed(2)),
      });
    }

    if (transaction.destination) {
      rows.push({
        entityType: transaction.destination,
        entityId: transaction.to,
        delta: Number((amount * direction).toFixed(2)),
      });
    }

    if (transactionCost > 0) {
      if (transaction.source === 'account' && transaction.from) {
        rows.push({
          entityType: 'account',
          entityId: transaction.from,
          delta: Number((-transactionCost * direction).toFixed(2)),
        });
      } else if (transaction.destination === 'account' && transaction.to) {
        rows.push({
          entityType: 'account',
          entityId: transaction.to,
          delta: Number((-transactionCost * direction).toFixed(2)),
        });
      }
    }
  }

  return rows;
}

async function validateTransactionRows(db, rows, options = {}) {
  if (options.direction === -1) {
    return [];
  }

  const errors = [];
  for (const row of rows) {
    if (row.entityType !== 'account' || row.delta >= 0) {
      continue;
    }

    try {
      const account = await db.get(row.entityId);
      const nextBalance = toNumber(account.balance) + toNumber(row.delta);
      if (nextBalance < 0) {
        errors.push(`Insufficient balance in account ${account.name || row.entityId}`);
      }
    } catch (error) {
      errors.push(`Account ${row.entityId} not found`);
    }
  }

  return errors;
}

async function previewSaleEffects(db, saleData, options = {}) {
  const sale = buildSaleDocument(saleData, {
    reconciliationCaseIds: dedupeIds([
      ...(saleData.reconciliationCaseIds || []),
      options.reconciliationCaseId,
    ]),
  });
  const errors = [];
  const stockDeltas = [];
  const paymentTotal = getSalePaymentBreakdown(sale).reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  if (Math.abs(paymentTotal - Math.abs(toNumber(sale.totalAmount))) > 0.01) {
    errors.push('Payment breakdown must equal the sale total');
  }
  if (getSalePaymentBreakdown(sale).some((payment) => toNumber(payment.transactionCost) > toNumber(payment.amount))) {
    errors.push('A payment fee cannot exceed its payment amount');
  }

  errors.push(...await validateSalePaymentAccounts(db, sale));

  for (const item of sale.items) {
    if (!item.productId) {
      errors.push(`Sale item "${item.name || item._id}" is missing a product reference`);
      continue;
    }

    try {
      const product = await db.get(item.productId);
      const baseUnits = Math.abs(toNumber(item.quantity) * (Math.abs(toNumber(item.conversionFactor)) || 1));
      const condition = item.condition || 'sellable';
      let quantityDelta = 0;

      if (sale.saleType === 'NEW SALE') {
        quantityDelta = -baseUnits;
        if (toNumber(product.stock) + quantityDelta < 0) {
          errors.push(`${product.name} has insufficient stock for this action`);
        }
      } else if (sale.saleType === 'RETURN SALE') {
        quantityDelta = condition === 'sellable' ? baseUnits : 0;
      }

      stockDeltas.push({
        productId: product._id,
        productName: product.name,
        saleLineId: item._id,
        quantityDelta: Number(quantityDelta.toFixed(2)),
        condition,
      });
    } catch (error) {
      errors.push(`Product ${item.productId} not found`);
    }
  }

  const { customerDeltas, accountDeltas } = await getSaleBalanceRows(db, sale, options);

  return {
    sale,
    stockDeltas,
    customerDeltas,
    accountDeltas,
    validationErrors: errors,
  };
}

async function restoreProductSnapshot(db, snapshot) {
  try {
    const current = await db.get(snapshot._id);
    await db.put({
      ...snapshot,
      _rev: current._rev,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to roll back product stock for ${snapshot._id}:`, error);
  }
}

async function deactivateStockMovement(db, movement) {
  try {
    const current = await db.get(movement._id);
    await db.put({
      ...current,
      state: 'Inactive',
      status: 'rolled_back',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to roll back stock movement ${movement._id}:`, error);
  }
}

async function rollbackSaleStockEffects(db, productSnapshots = new Map(), stockMovements = []) {
  await Promise.all([
    ...Array.from(productSnapshots.values()).map((snapshot) => restoreProductSnapshot(db, snapshot)),
    ...stockMovements.map((movement) => deactivateStockMovement(db, movement)),
  ]);
}

async function markSalePostingFailed(db, sale, error) {
  try {
    const current = await db.get(sale._id);
    await db.put({
      ...current,
      state: 'Inactive',
      status: 'failed',
      postingError: error.message || String(error),
      updatedAt: new Date().toISOString(),
    });
  } catch (rollbackError) {
    console.error(`Failed to mark sale ${sale._id} as failed:`, rollbackError);
  }
}

function sendRestockNotifications(products = [], mainWindow) {
  if (!mainWindow?.webContents) {
    return;
  }

  for (const product of products) {
    mainWindow.webContents.send('restock-triggered', product);
  }
}

async function applySaleStockEffects(db, sale, options = {}) {
  const movementInputs = [];
  const stockMovements = [];
  const productSnapshots = new Map();
  const restockProducts = [];

  try {
    for (const item of sale.items) {
      if (!item.productId) {
        continue;
      }

      const baseUnits = Math.abs(toNumber(item.quantity) * (Math.abs(toNumber(item.conversionFactor)) || 1));
      const condition = item.condition || 'sellable';
      let quantityDelta = 0;

      if (sale.saleType === 'NEW SALE') {
        quantityDelta = -baseUnits;
      } else if (sale.saleType === 'RETURN SALE') {
        quantityDelta = condition === 'sellable' ? baseUnits : 0;
      }

      if (quantityDelta !== 0) {
        const maxAttempts = 3;
        let attempt = 0;
        let updatedProduct = null;
        let shouldTriggerRestock = false;

        while (attempt < maxAttempts) {
          attempt += 1;
          const product = await db.get(item.productId);

          const stockResult = applyStockDeltaToProduct(product, quantityDelta);
          updatedProduct = stockResult.updatedProduct;
          shouldTriggerRestock = stockResult.shouldTriggerRestock;

          try {
            await db.put(updatedProduct);
            if (!productSnapshots.has(product._id)) {
              productSnapshots.set(product._id, product);
            }
            break;
          } catch (error) {
            if (isConflictError(error) && attempt < maxAttempts) {
              continue;
            }
            throw error;
          }
        }

        if (shouldTriggerRestock && updatedProduct) {
          restockProducts.push(updatedProduct);
        }
      }

      movementInputs.push({
        storeNo: sale.storeNo,
        productId: item.productId,
        saleLineId: item._id,
        lineQuantity: item.quantity,
        conversionFactor: item.conversionFactor,
        quantityDelta,
        condition,
        sourceDocType: 'sale',
        sourceDocId: sale._id,
        reconciliationCaseId: options.reconciliationCaseId || null,
        metadata: {
          saleType: sale.saleType,
          reconciliationCaseType: sale.reconciliationCaseType || null,
        },
      });
    }

    for (const movementInput of movementInputs) {
      const movement = await recordStockMovement(db, movementInput);
      stockMovements.push(movement);
    }
  } catch (error) {
    await rollbackSaleStockEffects(db, productSnapshots, stockMovements);
    throw error;
  }

  return {
    stockMovements,
    productSnapshots,
    restockProducts,
  };
}

async function applySaleBalanceEffects(db, sale, options = {}) {
  const { customerDeltas, accountDeltas } = await getSaleBalanceRows(db, sale, options);
  const ledgerEntries = [];

  for (const row of [...customerDeltas, ...accountDeltas]) {
    await applyEntityBalanceDelta(db, row.entityType, row.entityId, row.delta);
    const ledgerEntry = await recordLedgerEntry(db, {
      storeNo: sale.storeNo,
      entityType: row.entityType,
      entityId: row.entityId,
      bucket: row.bucket,
      delta: row.delta,
      description: row.description,
      sourceDocType: 'sale',
      sourceDocId: sale._id,
      reconciliationCaseId: options.reconciliationCaseId || null,
      date: sale.createdAt,
      metadata: {
        saleType: sale.saleType,
        paymentMethod: sale.paymentMethod,
        paymentLegMethod: row.paymentMethod,
        paymentLegAmount: row.amount,
        paymentLegTransactionCost: row.transactionCost,
        saleStatus: sale.status,
      },
    });
    ledgerEntries.push(ledgerEntry);
  }

  return { ledgerEntries };
}

async function postSale(db, saleData, options = {}) {
  const sale = await attachOpenRegisterSessionToSale(db, buildSaleDocument(saleData, {
    reconciliationCaseIds: dedupeIds([
      ...(saleData.reconciliationCaseIds || []),
      options.reconciliationCaseId,
    ]),
    createdBy: buildActorReference(options.actor),
  }), options);

  const preview = await previewSaleEffects(db, sale, options);
  if (preview.validationErrors.length > 0) {
    return { success: false, error: preview.validationErrors.join(', ') };
  }

  let salePersisted = false;
  let stockEffects = null;
  let ledgerEntries = [];

  try {
    await db.put(sale);
    salePersisted = true;
    stockEffects = await applySaleStockEffects(db, sale, options);
    ({ ledgerEntries } = await applySaleBalanceEffects(db, sale, options));
    sendRestockNotifications(stockEffects.restockProducts, options.mainWindow);
  } catch (error) {
    if (stockEffects) {
      await rollbackSaleStockEffects(db, stockEffects.productSnapshots, stockEffects.stockMovements);
    }

    if (salePersisted) {
      await markSalePostingFailed(db, sale, error);
    }

    throw error;
  }

  return {
    success: true,
    sale,
    stockMovements: stockEffects.stockMovements,
    ledgerEntries,
  };
}

async function previewTransactionEffects(db, transactionData, options = {}) {
  const transaction = buildTransactionDocument(transactionData, {
    reconciliationCaseId: transactionData.reconciliationCaseId || options.reconciliationCaseId || null,
  });
  const rows = getTransactionImpactRows(transaction, options);
  const errors = await validateTransactionRows(db, rows, options);

  return {
    transaction,
    impactRows: rows,
    validationErrors: errors,
  };
}

async function applyTransactionBalanceEffects(db, transaction, options = {}) {
  const rows = getTransactionImpactRows(transaction, options);
  const errors = await validateTransactionRows(db, rows, options);
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  const ledgerEntries = [];

  for (const row of rows) {
    if (!row.entityId || !row.entityType || !row.delta) {
      continue;
    }

    await applyEntityBalanceDelta(db, row.entityType, row.entityId, row.delta);

    if (row.entityType === 'customer' || row.entityType === 'account') {
      const ledgerEntry = await recordLedgerEntry(db, {
        storeNo: transaction.storeNo,
        entityType: row.entityType,
        entityId: row.entityId,
        bucket: row.entityType === 'customer' ? 'customer_balance' : 'account_balance',
        delta: row.delta,
        description: options.direction === -1
          ? `Reversal: ${transaction.description || 'Transaction correction'}`
          : (transaction.description || 'Transaction posted'),
        sourceDocType: 'transaction',
        sourceDocId: transaction._id,
        reconciliationCaseId: transaction.reconciliationCaseId || options.reconciliationCaseId || null,
        date: transaction.date,
        metadata: {
          source: transaction.source,
          destination: transaction.destination,
          transType: transaction.transType,
          direction: options.direction === -1 ? 'reversal' : 'posted',
        },
      });
      ledgerEntries.push(ledgerEntry);
    }
  }

  return { impactRows: rows, ledgerEntries };
}

async function postTransaction(db, transactionData, options = {}) {
  const transaction = await attachOpenRegisterSessionToTransaction(db, buildTransactionDocument(transactionData, {
    reconciliationCaseId: transactionData.reconciliationCaseId || options.reconciliationCaseId || null,
  }), options);

  const preview = await previewTransactionEffects(db, transaction, options);
  if (preview.validationErrors.length > 0) {
    return { success: false, error: preview.validationErrors.join(', ') };
  }

  await db.put(transaction);
  const { impactRows, ledgerEntries } = await applyTransactionBalanceEffects(db, transaction, options);

  return {
    success: true,
    transaction,
    impactRows,
    ledgerEntries,
  };
}

module.exports = {
  applyStockDeltaToProduct,
  applyEntityBalanceDelta,
  attachOpenRegisterSessionForAccount,
  buildActorReference,
  buildSaleDocument,
  buildTransactionDocument,
  getOpenRegisterSession,
  assertShiftOwner,
  getCurrentCustomerId,
  getSaleMetricSign,
  getSaleNetAmount,
  getSaleNetCost,
  getSaleNetItemSubtotal,
  getSalePaymentBreakdown,
  getTransactionImpactRows,
  normalizePaymentMethod,
  normalizeRole,
  postSale,
  postTransaction,
  previewSaleEffects,
  previewTransactionEffects,
  recordLedgerEntry,
  recordStockMovement,
  shouldIncludeSaleInMetrics,
  shouldIncludeTransactionInMetrics,
  toIsoString,
  toNumber,
};
