const { v4: uuidv4 } = require('uuid');
const {
  applyEntityBalanceDelta,
  buildActorReference,
  buildSaleDocument,
  buildTransactionDocument,
  getCurrentCustomerId,
  getSalePaymentBreakdown,
  normalizeRole,
  postSale,
  postTransaction,
  previewSaleEffects,
  previewTransactionEffects,
  recordLedgerEntry,
  recordStockMovement,
  toIsoString,
  toNumber,
} = require('./postingService');

const APPROVER_ROLES = new Set(['admin', 'operator', 'manager']);

function summarizeImpact(stockDeltas = [], customerDeltas = [], accountDeltas = [], supplierDeltas = []) {
  return {
    stockDeltaCount: stockDeltas.length,
    customerDeltaCount: customerDeltas.length,
    accountDeltaCount: accountDeltas.length,
    supplierDeltaCount: supplierDeltas.length,
    stockDeltaTotal: Number(stockDeltas.reduce((sum, row) => sum + toNumber(row.quantityDelta), 0).toFixed(2)),
    customerDeltaTotal: Number(customerDeltas.reduce((sum, row) => sum + toNumber(row.delta), 0).toFixed(2)),
    accountDeltaTotal: Number(accountDeltas.reduce((sum, row) => sum + toNumber(row.delta), 0).toFixed(2)),
    supplierDeltaTotal: Number(supplierDeltas.reduce((sum, row) => sum + toNumber(row.delta), 0).toFixed(2)),
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function getUnitNetPrice(item = {}) {
  const quantity = Math.abs(toNumber(item.quantity)) || 1;
  const subtotal = Math.abs(toNumber(item.subtotal));
  if (subtotal > 0) {
    return Number((subtotal / quantity).toFixed(2));
  }
  return Number(Math.abs(toNumber(item.unitPrice)).toFixed(2));
}

function getReturnableQuantity(item = {}, returnedMap = {}) {
  const sold = Math.abs(toNumber(item.quantity));
  const alreadyReturned = Math.abs(toNumber(returnedMap[item._id]));
  return Number(Math.max(0, sold - alreadyReturned).toFixed(2));
}

function nextReturnedQuantitiesByLine(sale, returnLines) {
  const currentMap = { ...(sale.returnedQuantitiesByLine || {}) };

  for (const line of returnLines) {
    currentMap[line.saleLineId] = Number((toNumber(currentMap[line.saleLineId]) + Math.abs(toNumber(line.quantity))).toFixed(2));
  }

  return currentMap;
}

function getReturnStatusForSale(sale, returnedMap) {
  const items = sale.items || [];
  if (items.length === 0) {
    return 'posted';
  }

  const allReturned = items.every((item) => getReturnableQuantity(item, returnedMap) <= 0);
  return allReturned ? 'fully_returned' : 'partially_returned';
}

function getOutstandingCreditAmount(sale) {
  const returnedMap = sale.returnedQuantitiesByLine || {};
  const creditAmount = getSalePaymentBreakdown(sale)
    .filter((payment) => payment.method === 'CREDIT')
    .reduce((sum, payment) => sum + Math.abs(toNumber(payment.amount)), 0);
  const totalAmount = Math.abs(toNumber(sale.totalAmount));
  const creditRatio = totalAmount > 0 ? creditAmount / totalAmount : 0;

  const outstandingSaleAmount = (sale.items || []).reduce((sum, item) => {
    const remainingQty = getReturnableQuantity(item, returnedMap);
    return sum + (remainingQty * getUnitNetPrice(item));
  }, 0);

  return Number((outstandingSaleAmount * creditRatio).toFixed(2));
}

function saleHasCreditPayment(sale = {}) {
  return getSalePaymentBreakdown(sale).some((payment) => payment.method === 'CREDIT');
}

function buildProportionalPaymentBreakdown(sourceSale = {}, totalAmount = 0) {
  const sourceTotal = Math.abs(toNumber(sourceSale.totalAmount));
  const targetTotal = Math.abs(toNumber(totalAmount));

  if (!sourceTotal || !targetTotal) {
    return [];
  }

  const payments = getSalePaymentBreakdown(sourceSale).map((payment) => ({
    method: payment.method,
    accountId: payment.accountId || null,
    amount: Number(((Math.abs(toNumber(payment.amount)) / sourceTotal) * targetTotal).toFixed(2)),
    transactionCost: 0,
  }));

  const allocated = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainder = Number((targetTotal - allocated).toFixed(2));
  if (payments.length > 0 && remainder !== 0) {
    payments[payments.length - 1].amount = Number((payments[payments.length - 1].amount + remainder).toFixed(2));
  }

  return payments;
}

function buildReturnSaleItems(sourceSale, returnLines) {
  const itemsById = new Map((sourceSale.items || []).map((item) => [item._id, item]));

  return returnLines
    .filter((line) => toNumber(line.quantity) > 0)
    .map((line) => {
      const sourceItem = itemsById.get(line.saleLineId);
      const quantity = Math.abs(toNumber(line.quantity));
      const unitNetPrice = getUnitNetPrice(sourceItem);
      const lineDiscount = Math.abs(toNumber(sourceItem.discount));
      const soldQty = Math.abs(toNumber(sourceItem.quantity)) || 1;

      return {
        _id: `${sourceSale.storeNo}:sale-line:${uuidv4()}`,
        productId: sourceItem.productId,
        variantId: sourceItem.variantId || null,
        name: sourceItem.name,
        buyPrice: sourceItem.buyPrice,
        unitPrice: sourceItem.unitPrice,
        quantity,
        subtotal: Number((-unitNetPrice * quantity).toFixed(2)),
        discount: Number(((lineDiscount / soldQty) * quantity).toFixed(2)),
        conversionFactor: sourceItem.conversionFactor,
        condition: line.condition || 'sellable',
      };
    });
}

function buildReplacementSaleItems(storeNo, replacementItems = []) {
  return replacementItems
    .filter((item) => toNumber(item.quantity) > 0)
    .map((item) => {
      const quantity = Math.abs(toNumber(item.quantity));
      const unitPrice = toNumber(item.unitPrice);

      return {
        _id: `${storeNo}:sale-line:${uuidv4()}`,
        productId: item.productId || item.parentProductId || item._productId || item.product?._id || null,
        variantId: item.variantId || item.variant_id || item._id || null,
        name: item.name || `${item.productName || ''} ${item.variantName || ''}`.trim(),
        buyPrice: toNumber(item.buyPrice),
        unitPrice,
        quantity,
        subtotal: Number((unitPrice * quantity).toFixed(2)),
        discount: toNumber(item.discount),
        conversionFactor: Math.abs(toNumber(item.conversionFactor)) || 1,
      };
    });
}

function buildReturnSaleData(sourceSale, caseDoc, returnItems, actor) {
  const totalAmount = Number(returnItems.reduce((sum, item) => sum + toNumber(item.subtotal), 0).toFixed(2));
  const totalDiscount = Number(returnItems.reduce((sum, item) => sum + Math.abs(toNumber(item.discount)), 0).toFixed(2));

  return buildSaleDocument({
    _id: `${sourceSale.storeNo}:sale:${uuidv4()}`,
    customerId: sourceSale.customerId,
    currentCustomerId: getCurrentCustomerId(sourceSale),
    items: returnItems,
    totalAmount,
    totalItems: returnItems.length,
    totalDiscount,
    servedBy: actor?.name || sourceSale.servedBy,
    amountPaid: 0,
    transactionCost: 0,
    change: 0,
    note: caseDoc.notes || `Reconciliation return for ${sourceSale._id}`,
    paymentMethod: sourceSale.paymentMethod,
    paymentBreakdown: buildProportionalPaymentBreakdown(sourceSale, totalAmount),
    saleType: 'RETURN SALE',
    fullfilmentType: sourceSale.fullfilmentType,
    paid: sourceSale.paid,
    storeNo: sourceSale.storeNo,
    status: 'posted',
    originSaleId: sourceSale._id,
    reconciliationCaseIds: [caseDoc._id],
    reconciliationCaseType: caseDoc.caseType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function buildReplacementSaleData(sourceSale, caseDoc, replacementItems, actor) {
  const totalAmount = Number(replacementItems.reduce((sum, item) => sum + toNumber(item.subtotal), 0).toFixed(2));
  const totalDiscount = Number(replacementItems.reduce((sum, item) => sum + toNumber(item.discount), 0).toFixed(2));

  return buildSaleDocument({
    _id: `${sourceSale.storeNo}:sale:${uuidv4()}`,
    customerId: sourceSale.customerId,
    currentCustomerId: getCurrentCustomerId(sourceSale),
    items: replacementItems,
    totalAmount,
    totalItems: replacementItems.length,
    totalDiscount,
    servedBy: actor?.name || sourceSale.servedBy,
    amountPaid: 0,
    transactionCost: 0,
    change: 0,
    note: caseDoc.notes || `Exchange replacement for ${sourceSale._id}`,
    paymentMethod: sourceSale.paymentMethod,
    paymentBreakdown: buildProportionalPaymentBreakdown(sourceSale, totalAmount),
    saleType: 'NEW SALE',
    fullfilmentType: sourceSale.fullfilmentType,
    paid: sourceSale.paid,
    storeNo: sourceSale.storeNo,
    status: 'posted',
    originSaleId: sourceSale._id,
    replacementOfSaleId: sourceSale._id,
    reconciliationCaseIds: [caseDoc._id],
    reconciliationCaseType: caseDoc.caseType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function buildReversalTransactionData(sourceTransaction, caseDoc) {
  return buildTransactionDocument({
    _id: `${sourceTransaction.storeNo}:transaction:${uuidv4()}`,
    from: sourceTransaction.from,
    to: sourceTransaction.to,
    source: sourceTransaction.source,
    destination: sourceTransaction.destination,
    description: `Reversal: ${sourceTransaction.description || sourceTransaction._id}`,
    amount: sourceTransaction.amount,
    transactionCost: sourceTransaction.transactionCost || 0,
    date: new Date().toISOString(),
    transType: sourceTransaction.transType,
    storeNo: sourceTransaction.storeNo,
    status: 'posted',
    reconciliationCaseId: caseDoc._id,
    reversalOfId: sourceTransaction._id,
    locked: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      caseType: caseDoc.caseType,
    },
  });
}

function buildReplacementTransactionData(sourceTransaction, caseDoc, replacementData = {}) {
  return buildTransactionDocument({
    _id: `${sourceTransaction.storeNo}:transaction:${uuidv4()}`,
    from: replacementData.from || sourceTransaction.from,
    to: replacementData.to || sourceTransaction.to,
    source: replacementData.source || sourceTransaction.source,
    destination: replacementData.destination || sourceTransaction.destination,
    description: replacementData.description || sourceTransaction.description,
    amount: replacementData.amount !== undefined ? replacementData.amount : sourceTransaction.amount,
    transactionCost: replacementData.transactionCost !== undefined
      ? replacementData.transactionCost
      : (sourceTransaction.transactionCost || 0),
    date: replacementData.date || new Date().toISOString(),
    transType: replacementData.transType || sourceTransaction.transType,
    storeNo: sourceTransaction.storeNo,
    status: 'posted',
    reconciliationCaseId: caseDoc._id,
    replacementOfId: sourceTransaction._id,
    locked: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      caseType: caseDoc.caseType,
    },
  });
}

async function getSaleOrError(db, saleId) {
  const sale = await db.get(saleId);
  if (sale.type !== 'sale') {
    throw new Error('Selected source is not a sale');
  }
  return sale;
}

async function getTransactionOrError(db, transactionId) {
  const transaction = await db.get(transactionId);
  if (transaction.type !== 'transaction') {
    throw new Error('Selected source is not a transaction');
  }
  return transaction;
}

async function getInvoiceOrError(db, invoiceId) {
  const invoice = await db.get(invoiceId);
  if (invoice.type !== 'invoice') {
    throw new Error('Selected source is not an invoice');
  }
  return invoice;
}

function invoiceIsVoided(invoice = {}) {
  return invoice.status === 'voided';
}

function getInvoiceLineId(invoice, item, index) {
  return item._id || item.lineId || `${invoice._id}:line:${index}`;
}

function getInvoiceLineQuantity(item = {}) {
  return Math.abs(toNumber(item.quantity));
}

function getInvoiceLineBuyPrice(item = {}) {
  return Math.abs(toNumber(item.buyPrice));
}

function getInvoiceLineSubtotal(item = {}) {
  const providedSubtotal = Number(item.subtotal);
  if (Number.isFinite(providedSubtotal)) {
    return Number(Math.abs(providedSubtotal).toFixed(2));
  }

  return Number((getInvoiceLineQuantity(item) * getInvoiceLineBuyPrice(item)).toFixed(2));
}

function getInvoiceLineBaseConversion(item = {}) {
  const quantity = getInvoiceLineQuantity(item);
  const baseQuantity = item.baseQuantity !== undefined
    ? Math.abs(toNumber(item.baseQuantity))
    : quantity;

  if (quantity > 0 && baseQuantity > 0) {
    return baseQuantity / quantity;
  }

  return Math.abs(toNumber(item.conversionFactor)) || 1;
}

function getInvoiceLineBaseQuantity(item = {}, quantity = item.quantity) {
  return Number((Math.abs(toNumber(quantity)) * getInvoiceLineBaseConversion(item)).toFixed(2));
}

function getInvoiceTotal(invoice = {}) {
  const providedTotal = Number(invoice.totalAmount);
  if (Number.isFinite(providedTotal)) {
    return Number(Math.abs(providedTotal).toFixed(2));
  }

  return Number((invoice.items || []).reduce((sum, item) => sum + getInvoiceLineSubtotal(item), 0).toFixed(2));
}

function findInvoiceLine(invoice, requestedLine = {}) {
  const items = invoice.items || [];

  if (requestedLine.lineId) {
    const index = items.findIndex((item) => item._id === requestedLine.lineId || item.lineId === requestedLine.lineId);
    if (index !== -1) {
      return { item: items[index], index };
    }
  }

  const lineIndex = Number(requestedLine.lineIndex);
  if (Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < items.length) {
    return { item: items[lineIndex], index: lineIndex };
  }

  return { item: null, index: -1 };
}

function buildInvoiceLineCorrection(invoice, requestedLine) {
  const { item, index } = findInvoiceLine(invoice, requestedLine);
  if (!item) {
    return { error: 'Invoice line was not found', index };
  }

  const originalQuantity = getInvoiceLineQuantity(item);
  const originalBuyPrice = getInvoiceLineBuyPrice(item);
  const correctedQuantity = Math.abs(toNumber(requestedLine.correctedQuantity));
  const correctedBuyPrice = Math.abs(toNumber(requestedLine.correctedBuyPrice));
  const originalBaseQuantity = getInvoiceLineBaseQuantity(item, originalQuantity);
  const correctedBaseQuantity = getInvoiceLineBaseQuantity(item, correctedQuantity);
  const originalSubtotal = getInvoiceLineSubtotal(item);
  const correctedSubtotal = Number((correctedQuantity * correctedBuyPrice).toFixed(2));
  const quantityDelta = Number((correctedBaseQuantity - originalBaseQuantity).toFixed(2));
  const amountDelta = Number((correctedSubtotal - originalSubtotal).toFixed(2));

  return {
    lineId: item._id || item.lineId || null,
    lineIndex: index,
    productId: item.productId,
    productName: item.productName || item.name || 'Invoice item',
    originalQuantity,
    originalBuyPrice,
    originalBaseQuantity,
    originalSubtotal,
    correctedQuantity,
    correctedBuyPrice,
    correctedBaseQuantity,
    correctedSubtotal,
    baseConversion: getInvoiceLineBaseConversion(item),
    quantityDelta,
    amountDelta,
    expiryDate: item.expiryDate || null,
  };
}

async function validateInvoiceStockDeltas(db, stockDeltas = []) {
  const validationErrors = [];
  const productTotals = new Map();
  const productDocs = new Map();

  for (const delta of stockDeltas) {
    if (!delta.productId || !delta.quantityDelta) {
      continue;
    }

    productTotals.set(
      delta.productId,
      Number((toNumber(productTotals.get(delta.productId)) + toNumber(delta.quantityDelta)).toFixed(2))
    );
  }

  for (const [productId, totalDelta] of productTotals.entries()) {
    try {
      const product = await db.get(productId);
      if (product.type !== 'product') {
        validationErrors.push(`${productId} is not a product`);
        continue;
      }

      const nextStock = Number((toNumber(product.stock) + totalDelta).toFixed(2));
      if (nextStock < 0) {
        validationErrors.push(`${product.name || productId} has insufficient stock for this invoice correction`);
      }

      productDocs.set(productId, { product, projectedStock: nextStock });
    } catch (error) {
      validationErrors.push(`Product ${productId} was not found`);
    }
  }

  const enrichedDeltas = [];
  for (const delta of stockDeltas) {
    if (!delta.productId || !delta.quantityDelta) {
      continue;
    }

    const productInfo = productDocs.get(delta.productId);
    if (productInfo) {
      const { product, projectedStock } = productInfo;
      enrichedDeltas.push({
        ...delta,
        productName: product.name || delta.productName,
        currentStock: Number(toNumber(product.stock).toFixed(2)),
        projectedStock,
      });
    }
  }

  return { validationErrors, stockDeltas: enrichedDeltas };
}

function buildInvoiceVoidDeltas(invoice = {}) {
  const stockDeltas = (invoice.items || [])
    .map((item, index) => {
      const quantityDelta = Number((-getInvoiceLineBaseQuantity(item)).toFixed(2));
      return {
        productId: item.productId,
        productName: item.productName || item.name || 'Invoice item',
        invoiceLineId: item._id || item.lineId || null,
        invoiceLineIndex: index,
        lineQuantity: getInvoiceLineQuantity(item),
        conversionFactor: getInvoiceLineBaseConversion(item),
        quantityDelta,
        condition: 'sellable',
        expiryDate: item.expiryDate || null,
      };
    })
    .filter((delta) => delta.productId && delta.quantityDelta);

  const total = getInvoiceTotal(invoice);
  const supplierDeltas = total ? [{
    entityType: 'supplier',
    entityId: invoice.supplierId,
    delta: Number((-total).toFixed(2)),
    bucket: 'supplier_balance',
    description: `Voided supplier invoice ${invoice._id}`,
  }] : [];

  return { stockDeltas, supplierDeltas };
}

async function previewInvoiceVoidCase(db, payload) {
  const invoice = await getInvoiceOrError(db, payload.sourceId);
  const validationErrors = [];

  if (invoiceIsVoided(invoice)) {
    validationErrors.push('This invoice is already voided');
  }

  if (!invoice.supplierId) {
    validationErrors.push('Invoice is missing supplier information');
  }

  const { stockDeltas, supplierDeltas } = buildInvoiceVoidDeltas(invoice);
  const stockValidation = await validateInvoiceStockDeltas(db, stockDeltas);

  return {
    source: invoice,
    normalizedPayload: {},
    stockDeltas: stockValidation.stockDeltas,
    customerDeltas: [],
    accountDeltas: [],
    supplierDeltas,
    validationErrors: [...validationErrors, ...stockValidation.validationErrors],
  };
}

async function previewInvoiceAdjustmentCase(db, payload) {
  const invoice = await getInvoiceOrError(db, payload.sourceId);
  const validationErrors = [];

  if (invoiceIsVoided(invoice)) {
    validationErrors.push('Voided invoices cannot be adjusted');
  }

  if (!invoice.supplierId) {
    validationErrors.push('Invoice is missing supplier information');
  }

  if (!Array.isArray(payload.adjustmentLines) || payload.adjustmentLines.length === 0) {
    validationErrors.push('Select at least one invoice line to adjust');
  }

  const corrections = (payload.adjustmentLines || [])
    .map((line) => buildInvoiceLineCorrection(invoice, line))
    .filter((correction) => {
      if (correction.error) {
        validationErrors.push(correction.error);
        return false;
      }

      return correction.quantityDelta !== 0 || correction.amountDelta !== 0;
    });

  if ((payload.adjustmentLines || []).length > 0 && corrections.length === 0) {
    validationErrors.push('No invoice quantity or price changes were entered');
  }

  const stockDeltas = corrections
    .filter((correction) => correction.quantityDelta !== 0)
    .map((correction) => ({
      productId: correction.productId,
      productName: correction.productName,
      invoiceLineId: correction.lineId,
      invoiceLineIndex: correction.lineIndex,
      lineQuantity: Math.abs(correction.correctedQuantity - correction.originalQuantity),
      conversionFactor: correction.baseConversion,
      quantityDelta: correction.quantityDelta,
      condition: 'sellable',
      expiryDate: correction.expiryDate,
    }));

  const supplierDeltaTotal = Number(corrections.reduce((sum, correction) => sum + correction.amountDelta, 0).toFixed(2));
  const supplierDeltas = supplierDeltaTotal ? [{
    entityType: 'supplier',
    entityId: invoice.supplierId,
    delta: supplierDeltaTotal,
    bucket: 'supplier_balance',
    description: `Adjusted supplier invoice ${invoice._id}`,
  }] : [];

  const stockValidation = await validateInvoiceStockDeltas(db, stockDeltas);

  return {
    source: invoice,
    normalizedPayload: {
      adjustmentLines: corrections.map((correction) => ({
        lineId: correction.lineId,
        lineIndex: correction.lineIndex,
        correctedQuantity: correction.correctedQuantity,
        correctedBuyPrice: correction.correctedBuyPrice,
      })),
    },
    stockDeltas: stockValidation.stockDeltas,
    customerDeltas: [],
    accountDeltas: [],
    supplierDeltas,
    validationErrors: [...validationErrors, ...stockValidation.validationErrors],
  };
}

async function previewSaleReturnCase(db, payload) {
  const sale = await getSaleOrError(db, payload.sourceId);
  const validationErrors = [];

  if (sale.status === 'voided') {
    validationErrors.push('Voided sales cannot be reconciled with item returns');
  }

  const returnedMap = sale.returnedQuantitiesByLine || {};
  const returnLines = (payload.returnLines || [])
    .map((line) => ({
      saleLineId: line.saleLineId,
      quantity: Math.abs(toNumber(line.quantity)),
      condition: line.condition || 'sellable',
    }))
    .filter((line) => line.saleLineId && line.quantity > 0);

  if (returnLines.length === 0) {
    validationErrors.push('Select at least one return line with a quantity greater than zero');
  }

  for (const line of returnLines) {
    const saleItem = (sale.items || []).find((item) => item._id === line.saleLineId);
    if (!saleItem) {
      validationErrors.push(`Sale line ${line.saleLineId} was not found`);
      continue;
    }

    const remaining = getReturnableQuantity(saleItem, returnedMap);
    if (line.quantity > remaining) {
      validationErrors.push(`${saleItem.name} exceeds the remaining returnable quantity`);
    }
  }

  const returnItems = buildReturnSaleItems(sale, returnLines);
  const previewSale = buildReturnSaleData(sale, {
    _id: payload._id || 'preview',
    caseType: payload.caseType,
    notes: payload.notes,
  }, returnItems, buildActorReference(payload.initiatedBy));
  const preview = await previewSaleEffects(db, previewSale, {
    reconciliationCaseId: payload._id || null,
  });

  return {
    source: sale,
    normalizedPayload: {
      returnLines,
    },
    stockDeltas: preview.stockDeltas,
    customerDeltas: preview.customerDeltas,
    accountDeltas: preview.accountDeltas,
    validationErrors: [...validationErrors, ...preview.validationErrors],
  };
}

async function previewExchangeCase(db, payload) {
  const sale = await getSaleOrError(db, payload.sourceId);
  const basePreview = await previewSaleReturnCase(db, payload);
  const validationErrors = [...basePreview.validationErrors];

  if (sale.status === 'voided') {
    validationErrors.push('Voided sales cannot be exchanged');
  }

  const replacementItems = buildReplacementSaleItems(sale.storeNo, payload.replacementItems || []);
  if (replacementItems.length === 0) {
    validationErrors.push('Select at least one replacement item');
  }

  const replacementSale = buildReplacementSaleData(sale, {
    _id: payload._id || 'preview',
    caseType: payload.caseType,
    notes: payload.notes,
  }, replacementItems, buildActorReference(payload.initiatedBy));
  const replacementPreview = await previewSaleEffects(db, replacementSale, {
    reconciliationCaseId: payload._id || null,
  });

  return {
    source: sale,
    normalizedPayload: {
      returnLines: basePreview.normalizedPayload.returnLines,
      replacementItems: replacementItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        buyPrice: item.buyPrice,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discount: item.discount,
        conversionFactor: item.conversionFactor,
      })),
    },
    stockDeltas: [...basePreview.stockDeltas, ...replacementPreview.stockDeltas],
    customerDeltas: [...basePreview.customerDeltas, ...replacementPreview.customerDeltas],
    accountDeltas: [...basePreview.accountDeltas, ...replacementPreview.accountDeltas],
    validationErrors: [...validationErrors, ...replacementPreview.validationErrors],
  };
}

async function previewVoidCase(db, payload) {
  const sale = await getSaleOrError(db, payload.sourceId);
  const validationErrors = [];

  if (sale.status === 'voided') {
    validationErrors.push('This sale is already voided');
  }

  const alreadyReturned = Object.values(sale.returnedQuantitiesByLine || {}).some((value) => toNumber(value) > 0);
  if (alreadyReturned) {
    validationErrors.push('Partially returned sales cannot be voided');
  }

  const returnLines = (sale.items || []).map((item) => ({
    saleLineId: item._id,
    quantity: Math.abs(toNumber(item.quantity)),
    condition: 'sellable',
  }));

  const reversalItems = buildReturnSaleItems(sale, returnLines);
  const previewSale = buildReturnSaleData(sale, {
    _id: payload._id || 'preview',
    caseType: payload.caseType,
    notes: payload.notes,
  }, reversalItems, buildActorReference(payload.initiatedBy));
  previewSale.reconciliationCaseType = 'sale_void';

  const preview = await previewSaleEffects(db, previewSale, {
    reconciliationCaseId: payload._id || null,
  });

  return {
    source: sale,
    normalizedPayload: {
      returnLines,
    },
    stockDeltas: preview.stockDeltas,
    customerDeltas: preview.customerDeltas,
    accountDeltas: preview.accountDeltas,
    validationErrors: [...validationErrors, ...preview.validationErrors],
  };
}

async function previewWrongCustomerCase(db, payload) {
  const sale = await getSaleOrError(db, payload.sourceId);
  const validationErrors = [];
  const currentCustomerId = getCurrentCustomerId(sale);
  const newCustomerId = payload.newCustomerId;

  if (!newCustomerId) {
    validationErrors.push('Select the correct customer for this sale');
  }

  if (newCustomerId && newCustomerId === currentCustomerId) {
    validationErrors.push('The new customer must be different from the current customer');
  }

  let nextCustomer = null;
  if (newCustomerId) {
    try {
      nextCustomer = await db.get(newCustomerId);
      if (nextCustomer.type !== 'customer') {
        validationErrors.push('Selected replacement customer is invalid');
      }
    } catch (error) {
      validationErrors.push('Selected replacement customer was not found');
    }
  }

  const customerDeltas = [];
  if (saleHasCreditPayment(sale) && currentCustomerId && nextCustomer) {
    const transferAmount = getOutstandingCreditAmount(sale);
    customerDeltas.push({
      entityType: 'customer',
      entityId: currentCustomerId,
      delta: Number(transferAmount.toFixed(2)),
      bucket: 'customer_balance',
      description: `Reassigned debt from sale ${sale._id}`,
    });
    customerDeltas.push({
      entityType: 'customer',
      entityId: nextCustomer._id,
      delta: Number((-transferAmount).toFixed(2)),
      bucket: 'customer_balance',
      description: `Assigned debt from sale ${sale._id}`,
    });
  }

  return {
    source: sale,
    normalizedPayload: {
      newCustomerId,
    },
    stockDeltas: [],
    customerDeltas,
    accountDeltas: [],
    validationErrors,
  };
}

async function previewTransactionCase(db, payload) {
  const transaction = await getTransactionOrError(db, payload.sourceId);
  const validationErrors = [];

  if (transaction.status === 'reversed' || transaction.status === 'replaced') {
    validationErrors.push('This transaction has already been corrected');
  }

  const reversalTransaction = buildReversalTransactionData(transaction, {
    _id: payload._id || 'preview',
    caseType: payload.caseType,
  });
  const reversalPreview = await previewTransactionEffects(db, reversalTransaction, {
    reconciliationCaseId: payload._id || null,
    direction: -1,
  });

  const customerDeltas = reversalPreview.impactRows
    .filter((row) => row.entityType === 'customer')
    .map((row) => ({
      ...row,
      bucket: 'customer_balance',
      description: reversalTransaction.description,
    }));

  const accountDeltas = reversalPreview.impactRows
    .filter((row) => row.entityType === 'account')
    .map((row) => ({
      ...row,
      bucket: 'account_balance',
      description: reversalTransaction.description,
    }));

  const normalizedPayload = {
    replacementTransaction: null,
  };

  if (payload.replacementTransaction) {
    const replacementTransaction = buildReplacementTransactionData(transaction, {
      _id: payload._id || 'preview',
      caseType: payload.caseType,
    }, payload.replacementTransaction);
    const replacementPreview = await previewTransactionEffects(db, replacementTransaction, {
      reconciliationCaseId: payload._id || null,
      direction: 1,
    });

    customerDeltas.push(...replacementPreview.impactRows
      .filter((row) => row.entityType === 'customer')
      .map((row) => ({
        ...row,
        bucket: 'customer_balance',
        description: replacementTransaction.description,
      })));

    accountDeltas.push(...replacementPreview.impactRows
      .filter((row) => row.entityType === 'account')
      .map((row) => ({
        ...row,
        bucket: 'account_balance',
        description: replacementTransaction.description,
      })));

    normalizedPayload.replacementTransaction = {
      from: replacementTransaction.from,
      to: replacementTransaction.to,
      source: replacementTransaction.source,
      destination: replacementTransaction.destination,
      description: replacementTransaction.description,
      amount: replacementTransaction.amount,
      transactionCost: replacementTransaction.transactionCost,
      date: replacementTransaction.date,
      transType: replacementTransaction.transType,
    };

    validationErrors.push(...replacementPreview.validationErrors);
  }

  return {
    source: transaction,
    normalizedPayload,
    stockDeltas: [],
    customerDeltas,
    accountDeltas,
    validationErrors: [...validationErrors, ...reversalPreview.validationErrors],
  };
}

async function previewReconciliation(db, payload) {
  const caseType = payload.caseType;
  let preview;

  if (caseType === 'item_return') {
    preview = await previewSaleReturnCase(db, payload);
  } else if (caseType === 'item_exchange') {
    preview = await previewExchangeCase(db, payload);
  } else if (caseType === 'sale_void') {
    preview = await previewVoidCase(db, payload);
  } else if (caseType === 'wrong_customer') {
    preview = await previewWrongCustomerCase(db, payload);
  } else if (caseType === 'transaction_correction') {
    preview = await previewTransactionCase(db, payload);
  } else if (caseType === 'invoice_void') {
    preview = await previewInvoiceVoidCase(db, payload);
  } else if (caseType === 'invoice_adjustment') {
    preview = await previewInvoiceAdjustmentCase(db, payload);
  } else {
    return { success: false, error: `Unsupported reconciliation case type: ${caseType}` };
  }

  return {
    success: true,
    impactPreview: {
      stockDeltas: preview.stockDeltas,
      customerDeltas: preview.customerDeltas,
      accountDeltas: preview.accountDeltas,
      supplierDeltas: preview.supplierDeltas || [],
      requiresApproval: true,
      validationErrors: preview.validationErrors,
      summary: summarizeImpact(
        preview.stockDeltas,
        preview.customerDeltas,
        preview.accountDeltas,
        preview.supplierDeltas || []
      ),
    },
    normalizedPayload: preview.normalizedPayload,
    sourceSnapshot: clonePlain(preview.source),
  };
}

async function createReconciliationCase(db, payload) {
  if (!payload.storeNo) {
    return { success: false, error: 'storeNo is required' };
  }

  if (!payload.caseType || !payload.sourceType || !payload.sourceId) {
    return { success: false, error: 'caseType, sourceType, and sourceId are required' };
  }

  const preview = await previewReconciliation(db, payload);
  if (!preview.success) {
    return preview;
  }

  if (preview.impactPreview.validationErrors.length > 0) {
    return { success: false, error: preview.impactPreview.validationErrors.join(', '), impactPreview: preview.impactPreview };
  }

  const createdAt = new Date().toISOString();
  const reconciliationCase = {
    _id: payload._id || `${payload.storeNo}:reconciliation:${uuidv4()}`,
    type: 'reconciliation-case',
    state: 'Active',
    storeNo: payload.storeNo,
    caseType: payload.caseType,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    status: 'pending_approval',
    reasonCode: payload.reasonCode || 'general_correction',
    notes: payload.notes || '',
    initiatedBy: buildActorReference(payload.initiatedBy),
    approvedBy: null,
    rejectedBy: null,
    createdAt,
    updatedAt: createdAt,
    approvedAt: null,
    rejectedAt: null,
    impactPreview: preview.impactPreview,
    linkedDocIds: [],
    payload: preview.normalizedPayload,
    sourceSnapshot: preview.sourceSnapshot,
  };

  await db.put(reconciliationCase);

  return {
    success: true,
    reconciliation: reconciliationCase,
  };
}

async function approveItemReturnCase(db, caseDoc, approver, mainWindow) {
  const sale = await getSaleOrError(db, caseDoc.sourceId);
  const returnItems = buildReturnSaleItems(sale, caseDoc.payload.returnLines || []);
  const returnSaleData = buildReturnSaleData(sale, caseDoc, returnItems, approver);
  const postedReturn = await postSale(db, returnSaleData, {
    reconciliationCaseId: caseDoc._id,
    mainWindow,
    printReceipt: false,
  });

  if (!postedReturn.success) {
    throw new Error(postedReturn.error);
  }

  const updatedReturnedMap = nextReturnedQuantitiesByLine(sale, caseDoc.payload.returnLines || []);
  const updatedSale = {
    ...sale,
    returnedQuantitiesByLine: updatedReturnedMap,
    status: getReturnStatusForSale(sale, updatedReturnedMap),
    reconciliationCaseIds: Array.from(new Set([...(sale.reconciliationCaseIds || []), caseDoc._id])),
    updatedAt: new Date().toISOString(),
  };
  await db.put(updatedSale);

  return {
    linkedDocIds: [postedReturn.sale._id],
  };
}

async function approveExchangeCase(db, caseDoc, approver, mainWindow) {
  const sale = await getSaleOrError(db, caseDoc.sourceId);
  const returnItems = buildReturnSaleItems(sale, caseDoc.payload.returnLines || []);
  const replacementItems = buildReplacementSaleItems(sale.storeNo, caseDoc.payload.replacementItems || []);
  const returnSaleData = buildReturnSaleData(sale, caseDoc, returnItems, approver);
  const replacementSaleData = buildReplacementSaleData(sale, caseDoc, replacementItems, approver);

  const postedReturn = await postSale(db, returnSaleData, {
    reconciliationCaseId: caseDoc._id,
    mainWindow,
    printReceipt: false,
  });
  if (!postedReturn.success) {
    throw new Error(postedReturn.error);
  }

  const postedReplacement = await postSale(db, replacementSaleData, {
    reconciliationCaseId: caseDoc._id,
    mainWindow,
    printReceipt: false,
  });
  if (!postedReplacement.success) {
    throw new Error(postedReplacement.error);
  }

  const updatedReturnedMap = nextReturnedQuantitiesByLine(sale, caseDoc.payload.returnLines || []);
  const updatedSale = {
    ...sale,
    returnedQuantitiesByLine: updatedReturnedMap,
    status: getReturnStatusForSale(sale, updatedReturnedMap),
    reconciliationCaseIds: Array.from(new Set([...(sale.reconciliationCaseIds || []), caseDoc._id])),
    updatedAt: new Date().toISOString(),
  };
  await db.put(updatedSale);

  return {
    linkedDocIds: [postedReturn.sale._id, postedReplacement.sale._id],
  };
}

async function approveVoidCase(db, caseDoc, approver, mainWindow) {
  const sale = await getSaleOrError(db, caseDoc.sourceId);
  const returnItems = buildReturnSaleItems(sale, caseDoc.payload.returnLines || []);
  const reversalSaleData = buildReturnSaleData(sale, caseDoc, returnItems, approver);
  reversalSaleData.reconciliationCaseType = 'sale_void';

  const postedReturn = await postSale(db, reversalSaleData, {
    reconciliationCaseId: caseDoc._id,
    mainWindow,
    printReceipt: false,
  });
  if (!postedReturn.success) {
    throw new Error(postedReturn.error);
  }

  const updatedSale = {
    ...sale,
    status: 'voided',
    voidedAt: new Date().toISOString(),
    voidReasonCode: caseDoc.reasonCode,
    reconciliationCaseIds: Array.from(new Set([...(sale.reconciliationCaseIds || []), caseDoc._id])),
    updatedAt: new Date().toISOString(),
  };
  await db.put(updatedSale);

  return {
    linkedDocIds: [postedReturn.sale._id],
  };
}

async function approveWrongCustomerCase(db, caseDoc) {
  const sale = await getSaleOrError(db, caseDoc.sourceId);
  const currentCustomerId = getCurrentCustomerId(sale);
  const nextCustomerId = caseDoc.payload.newCustomerId;
  const outstandingAmount = saleHasCreditPayment(sale) ? getOutstandingCreditAmount(sale) : 0;

  const updatedSale = {
    ...sale,
    currentCustomerId: nextCustomerId,
    status: 'reassigned',
    reconciliationCaseIds: Array.from(new Set([...(sale.reconciliationCaseIds || []), caseDoc._id])),
    updatedAt: new Date().toISOString(),
  };
  await db.put(updatedSale);

  if (saleHasCreditPayment(sale) && outstandingAmount > 0) {
    await applyEntityBalanceDelta(db, 'customer', currentCustomerId, outstandingAmount);
    await applyEntityBalanceDelta(db, 'customer', nextCustomerId, -outstandingAmount);

    await recordLedgerEntry(db, {
      storeNo: sale.storeNo,
      entityType: 'customer',
      entityId: currentCustomerId,
      bucket: 'customer_balance',
      delta: outstandingAmount,
      description: `Wrong customer correction for sale ${sale._id}`,
      sourceDocType: 'sale',
      sourceDocId: sale._id,
      reconciliationCaseId: caseDoc._id,
      metadata: {
        direction: 'out',
      },
      date: new Date().toISOString(),
    });

    await recordLedgerEntry(db, {
      storeNo: sale.storeNo,
      entityType: 'customer',
      entityId: nextCustomerId,
      bucket: 'customer_balance',
      delta: -outstandingAmount,
      description: `Wrong customer correction for sale ${sale._id}`,
      sourceDocType: 'sale',
      sourceDocId: sale._id,
      reconciliationCaseId: caseDoc._id,
      metadata: {
        direction: 'in',
      },
      date: new Date().toISOString(),
    });
  }

  return {
    linkedDocIds: [],
  };
}

async function approveTransactionCorrectionCase(db, caseDoc) {
  const transaction = await getTransactionOrError(db, caseDoc.sourceId);
  const reversalTransactionData = buildReversalTransactionData(transaction, caseDoc);

  const postedReversal = await postTransaction(db, reversalTransactionData, {
    reconciliationCaseId: caseDoc._id,
    direction: -1,
  });
  if (!postedReversal.success) {
    throw new Error(postedReversal.error);
  }

  const linkedDocIds = [postedReversal.transaction._id];
  let nextStatus = 'reversed';

  if (caseDoc.payload.replacementTransaction) {
    const replacementTransactionData = buildReplacementTransactionData(transaction, caseDoc, caseDoc.payload.replacementTransaction);
    const postedReplacement = await postTransaction(db, replacementTransactionData, {
      reconciliationCaseId: caseDoc._id,
      direction: 1,
    });

    if (!postedReplacement.success) {
      throw new Error(postedReplacement.error);
    }

    linkedDocIds.push(postedReplacement.transaction._id);
    nextStatus = 'replaced';
  }

  const updatedTransaction = {
    ...transaction,
    status: nextStatus,
    reconciliationCaseId: caseDoc._id,
    updatedAt: new Date().toISOString(),
  };
  await db.put(updatedTransaction);

  return {
    linkedDocIds,
  };
}

function sortInvoiceBatchesByExpiry(batches = []) {
  return [...batches].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });
}

function applyInvoiceBatchDelta(product = {}, delta = {}) {
  const quantityDelta = toNumber(delta.quantityDelta);
  let updatedBatches = Array.isArray(product.batches) ? [...product.batches] : [];

  if (quantityDelta < 0 && updatedBatches.length > 0) {
    let remaining = Math.abs(quantityDelta);
    updatedBatches = sortInvoiceBatchesByExpiry(updatedBatches)
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
  } else if (quantityDelta > 0) {
    updatedBatches = [
      ...updatedBatches,
      {
        batchId: uuidv4(),
        expiryDate: delta.expiryDate || null,
        quantity: Number(quantityDelta.toFixed(2)),
        addedAt: new Date().toISOString(),
      },
    ];
  }

  return updatedBatches;
}

async function applyInvoiceStockDeltas(db, invoice, caseDoc, stockDeltas = [], mainWindow) {
  const stockMovements = [];
  const validation = await validateInvoiceStockDeltas(db, stockDeltas);
  if (validation.validationErrors.length > 0) {
    throw new Error(validation.validationErrors.join(', '));
  }

  for (const delta of stockDeltas) {
    const quantityDelta = toNumber(delta.quantityDelta);
    if (!delta.productId || !quantityDelta) {
      continue;
    }

    const product = await db.get(delta.productId);
    const updatedStock = Number((toNumber(product.stock) + quantityDelta).toFixed(2));
    if (updatedStock < 0) {
      throw new Error(`${product.name || delta.productName || delta.productId} has insufficient stock for this invoice correction`);
    }

    const wasAboveThreshold = toNumber(product.stock) >= toNumber(product.restockThreshold);
    const isNowBelowThreshold = updatedStock < toNumber(product.restockThreshold);
    const shouldTriggerRestock = quantityDelta < 0 && wasAboveThreshold && isNowBelowThreshold;
    const updatedProduct = {
      ...product,
      stock: updatedStock,
      batches: applyInvoiceBatchDelta(product, delta),
      restock: shouldTriggerRestock || product.restock,
      updatedAt: new Date().toISOString(),
    };

    await db.put(updatedProduct);

    if (shouldTriggerRestock && mainWindow?.webContents) {
      mainWindow.webContents.send('restock-triggered', updatedProduct);
    }

    const movement = await recordStockMovement(db, {
      storeNo: invoice.storeNo || invoice.store,
      productId: delta.productId,
      saleLineId: null,
      lineQuantity: delta.lineQuantity || Math.abs(quantityDelta),
      conversionFactor: delta.conversionFactor || 1,
      quantityDelta,
      condition: delta.condition || 'sellable',
      sourceDocType: 'invoice',
      sourceDocId: invoice._id,
      reconciliationCaseId: caseDoc._id,
      metadata: {
        caseType: caseDoc.caseType,
        invoiceLineId: delta.invoiceLineId || null,
        invoiceLineIndex: delta.invoiceLineIndex,
      },
    });

    stockMovements.push(movement);
  }

  return stockMovements;
}

function withInvoiceLineId(invoice, item, index) {
  if (item._id) {
    return item;
  }

  return {
    ...item,
    _id: `${invoice.storeNo || invoice.store || 'store'}:invoice-line:${uuidv4()}`,
  };
}

function buildAdjustedInvoice(invoice, adjustmentLines = [], caseDoc) {
  const linesByIndex = new Map((adjustmentLines || []).map((line) => [line.lineIndex, line]));
  const items = (invoice.items || []).map((item, index) => {
    const itemWithId = withInvoiceLineId(invoice, item, index);
    const correction = linesByIndex.get(index);

    if (!correction) {
      return itemWithId;
    }

    const correctedQuantity = Math.abs(toNumber(correction.correctedQuantity));
    const correctedBuyPrice = Math.abs(toNumber(correction.correctedBuyPrice));

    return {
      ...itemWithId,
      quantity: correctedQuantity,
      buyPrice: correctedBuyPrice,
      baseQuantity: getInvoiceLineBaseQuantity(item, correctedQuantity),
      subtotal: Number((correctedQuantity * correctedBuyPrice).toFixed(2)),
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    ...invoice,
    items,
    totalAmount: Number(items.reduce((sum, item) => sum + getInvoiceLineSubtotal(item), 0).toFixed(2)),
    totalItems: Number(items.reduce((sum, item) => sum + getInvoiceLineQuantity(item), 0).toFixed(2)),
    status: 'adjusted',
    adjustedAt: new Date().toISOString(),
    reconciliationCaseIds: Array.from(new Set([...(invoice.reconciliationCaseIds || []), caseDoc._id])),
    updatedAt: new Date().toISOString(),
  };
}

async function applySupplierDeltas(db, supplierDeltas = []) {
  for (const delta of supplierDeltas) {
    if (!delta.entityId || !delta.delta) {
      continue;
    }

    await applyEntityBalanceDelta(db, 'supplier', delta.entityId, delta.delta);
  }
}

async function approveInvoiceVoidCase(db, caseDoc, mainWindow) {
  const invoice = await getInvoiceOrError(db, caseDoc.sourceId);
  const preview = await previewInvoiceVoidCase(db, {
    _id: caseDoc._id,
    sourceId: caseDoc.sourceId,
  });

  if (preview.validationErrors.length > 0) {
    throw new Error(preview.validationErrors.join(', '));
  }

  const stockMovements = await applyInvoiceStockDeltas(db, invoice, caseDoc, preview.stockDeltas, mainWindow);
  await applySupplierDeltas(db, preview.supplierDeltas);

  const updatedInvoice = {
    ...invoice,
    items: (invoice.items || []).map((item, index) => withInvoiceLineId(invoice, item, index)),
    status: 'voided',
    voidedAt: new Date().toISOString(),
    voidReasonCode: caseDoc.reasonCode,
    reconciliationCaseIds: Array.from(new Set([...(invoice.reconciliationCaseIds || []), caseDoc._id])),
    updatedAt: new Date().toISOString(),
  };

  await db.put(updatedInvoice);

  return {
    linkedDocIds: [updatedInvoice._id, ...stockMovements.map((movement) => movement._id)],
  };
}

async function approveInvoiceAdjustmentCase(db, caseDoc, mainWindow) {
  const invoice = await getInvoiceOrError(db, caseDoc.sourceId);
  const preview = await previewInvoiceAdjustmentCase(db, {
    _id: caseDoc._id,
    sourceId: caseDoc.sourceId,
    adjustmentLines: caseDoc.payload.adjustmentLines || [],
  });

  if (preview.validationErrors.length > 0) {
    throw new Error(preview.validationErrors.join(', '));
  }

  const stockMovements = await applyInvoiceStockDeltas(db, invoice, caseDoc, preview.stockDeltas, mainWindow);
  await applySupplierDeltas(db, preview.supplierDeltas);

  const updatedInvoice = buildAdjustedInvoice(invoice, preview.normalizedPayload.adjustmentLines || [], caseDoc);
  await db.put(updatedInvoice);

  return {
    linkedDocIds: [updatedInvoice._id, ...stockMovements.map((movement) => movement._id)],
  };
}

async function approveReconciliationCase(db, caseId, approver, mainWindow) {
  const caseDoc = await db.get(caseId);
  if (caseDoc.type !== 'reconciliation-case') {
    return { success: false, error: 'Selected record is not a reconciliation case' };
  }

  if (caseDoc.status === 'posted') {
    return { success: false, error: 'This reconciliation case has already been posted' };
  }

  if (caseDoc.status === 'rejected') {
    return { success: false, error: 'Rejected reconciliation cases cannot be approved' };
  }

  const actor = buildActorReference(approver);
  if (!APPROVER_ROLES.has(normalizeRole(actor?.role))) {
    return { success: false, error: 'Only admin or operator staff can approve reconciliation cases' };
  }

  const preview = await previewReconciliation(db, {
    _id: caseDoc._id,
    storeNo: caseDoc.storeNo,
    caseType: caseDoc.caseType,
    sourceType: caseDoc.sourceType,
    sourceId: caseDoc.sourceId,
    notes: caseDoc.notes,
    initiatedBy: caseDoc.initiatedBy,
    ...caseDoc.payload,
  });

  if (!preview.success) {
    return preview;
  }

  if (preview.impactPreview.validationErrors.length > 0) {
    return {
      success: false,
      error: preview.impactPreview.validationErrors.join(', '),
      impactPreview: preview.impactPreview,
    };
  }

  let result;
  if (caseDoc.caseType === 'item_return') {
    result = await approveItemReturnCase(db, caseDoc, actor, mainWindow);
  } else if (caseDoc.caseType === 'item_exchange') {
    result = await approveExchangeCase(db, caseDoc, actor, mainWindow);
  } else if (caseDoc.caseType === 'sale_void') {
    result = await approveVoidCase(db, caseDoc, actor, mainWindow);
  } else if (caseDoc.caseType === 'wrong_customer') {
    result = await approveWrongCustomerCase(db, caseDoc);
  } else if (caseDoc.caseType === 'transaction_correction') {
    result = await approveTransactionCorrectionCase(db, caseDoc);
  } else if (caseDoc.caseType === 'invoice_void') {
    result = await approveInvoiceVoidCase(db, caseDoc, mainWindow);
  } else if (caseDoc.caseType === 'invoice_adjustment') {
    result = await approveInvoiceAdjustmentCase(db, caseDoc, mainWindow);
  } else {
    return { success: false, error: `Unsupported reconciliation case type: ${caseDoc.caseType}` };
  }

  const updatedCase = {
    ...caseDoc,
    status: 'posted',
    approvedBy: actor,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedDocIds: result.linkedDocIds,
  };
  await db.put(updatedCase);

  return {
    success: true,
    reconciliation: updatedCase,
  };
}

async function rejectReconciliationCase(db, caseId, rejectedBy, rejectionReason = '') {
  const caseDoc = await db.get(caseId);
  if (caseDoc.type !== 'reconciliation-case') {
    return { success: false, error: 'Selected record is not a reconciliation case' };
  }

  if (caseDoc.status === 'posted') {
    return { success: false, error: 'Posted reconciliation cases cannot be rejected' };
  }

  const actor = buildActorReference(rejectedBy);
  if (!APPROVER_ROLES.has(normalizeRole(actor?.role))) {
    return { success: false, error: 'Only admin or operator staff can reject reconciliation cases' };
  }

  const updatedCase = {
    ...caseDoc,
    status: 'rejected',
    rejectedBy: actor,
    rejectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: rejectionReason ? `${caseDoc.notes || ''}\n\nRejected: ${rejectionReason}`.trim() : caseDoc.notes,
  };
  await db.put(updatedCase);

  return {
    success: true,
    reconciliation: updatedCase,
  };
}

async function getReconciliationCases(db, storeNo, filters = {}) {
  const result = await db.find({
    selector: {
      type: 'reconciliation-case',
      state: 'Active',
      ...(storeNo ? { storeNo } : {}),
    },
    limit: 9999,
  });

  let cases = result.docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (filters.status) {
    cases = cases.filter((entry) => entry.status === filters.status);
  }

  if (filters.caseType) {
    cases = cases.filter((entry) => entry.caseType === filters.caseType);
  }

  return {
    success: true,
    reconciliations: cases,
  };
}

async function getReconciliationBySource(db, sourceType, sourceId, storeNo) {
  const result = await db.find({
    selector: {
      type: 'reconciliation-case',
      state: 'Active',
      sourceType,
      sourceId,
      ...(storeNo ? { storeNo } : {}),
    },
    limit: 9999,
  });

  return {
    success: true,
    reconciliations: result.docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
}

module.exports = {
  approveReconciliationCase,
  createReconciliationCase,
  getReconciliationBySource,
  getReconciliationCases,
  previewReconciliation,
  rejectReconciliationCase,
};
