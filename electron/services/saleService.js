const { printReceipt } = require('./printerService');
const {
  getCurrentCustomerId,
  getSaleNetAmount,
  getSaleNetCost,
  getSaleNetItemSubtotal,
  getSalePaymentBreakdown,
  getOpenRegisterSession,
  normalizePaymentMethod,
  applyEntityBalanceDelta,
  assertShiftOwner,
  buildActorReference,
  recordLedgerEntry,
  postSale,
  shouldIncludeSaleInMetrics,
  toIsoString,
  toNumber,
} = require('./postingService');
const { ensureJournalEntryForSale, ensureJournalEntryForSalePayment } = require('./finance/journalService');
const { findAll } = require('./pouchQueryService');

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function remainingReturnableByLine(sale = {}) {
  const returnedMap = sale.returnedQuantitiesByLine || {};
  return Object.fromEntries((sale.items || []).map((item) => {
    const sold = Math.abs(toNumber(item.quantity));
    const returned = Math.abs(toNumber(returnedMap[item._id]));
    const remaining = Number(Math.max(0, sold - returned).toFixed(2));
    return [item._id, remaining];
  }));
}

function decorateSale(sale = {}) {
  return {
    ...sale,
    currentCustomerId: getCurrentCustomerId(sale),
    netTotalAmount: getSaleNetAmount(sale),
    remainingReturnableByLine: remainingReturnableByLine(sale),
    status: sale.status || 'posted',
  };
}

const SALES_HISTORY_INDEX = 'sales-history-index';
const SALES_HISTORY_DDOC = 'sales-history';
const UNPAID_SALES_INDEX = 'unpaid-sales-index';
const UNPAID_SALES_DDOC = 'unpaid-sales';
const SHIFT_SALES_INDEX = 'shift-sales-index';
const SHIFT_SALES_DDOC = 'shift-sales';
const salesIndexPromises = new WeakMap();

async function ensureSalesHistoryIndex(db) {
  if (!salesIndexPromises.has(db)) {
    const promise = Promise.all([
      db.createIndex({
        index: {
          fields: ['storeNo', 'type', 'state', 'createdAt'],
        },
        ddoc: SALES_HISTORY_DDOC,
        name: SALES_HISTORY_INDEX,
      }),
      db.createIndex({
        index: {
          fields: ['storeNo', 'type', 'state', 'paid', 'createdAt'],
        },
        ddoc: UNPAID_SALES_DDOC,
        name: UNPAID_SALES_INDEX,
      }),
      db.createIndex({
        index: {
          fields: ['storeNo', 'type', 'state', 'registerSessionId'],
        },
        ddoc: SHIFT_SALES_DDOC,
        name: SHIFT_SALES_INDEX,
      }),
    ]).catch((error) => {
      salesIndexPromises.delete(db);
      throw error;
    });
    salesIndexPromises.set(db, promise);
  }

  await salesIndexPromises.get(db);
}

async function findSales(db, options = {}) {
  const {
    storeNo,
    state = 'Active',
    status,
    paid,
    startDate,
    endDate,
  } = options;
  const selector = {
    type: 'sale',
    state,
    ...(status ? { status } : {}),
    ...(typeof paid === 'boolean' ? { paid } : {}),
    ...(storeNo ? { storeNo } : {}),
  };
  const fromDate = toDateValue(startDate);
  const toDate = toDateValue(endDate);
  const canUseHistoryIndex = Boolean(storeNo);
  const useUnpaidIndex = paid === false;

  if (canUseHistoryIndex) {
    await ensureSalesHistoryIndex(db);
    selector.createdAt = {
      $gte: fromDate ? fromDate.toISOString() : '',
      ...(toDate ? { $lte: toDate.toISOString() } : {}),
    };
  }

  const result = await findAll(db, {
    selector,
    ...(canUseHistoryIndex ? {
      sort: [
        { storeNo: 'asc' },
        { type: 'asc' },
        { state: 'asc' },
        ...(useUnpaidIndex ? [{ paid: 'asc' }] : []),
        { createdAt: 'asc' },
      ],
      use_index: useUnpaidIndex
        ? [UNPAID_SALES_DDOC, UNPAID_SALES_INDEX]
        : [SALES_HISTORY_DDOC, SALES_HISTORY_INDEX],
    } : {}),
  });

  return result.docs.map(decorateSale);
}

async function getAllStoreSales(db, storeNo) {
  return findSales(db, { storeNo, state: 'Active' });
}

async function getFailedStoreSales(db, storeNo, startDate, endDate) {
  return findSales(db, {
    storeNo,
    state: 'Inactive',
    status: 'failed',
    startDate,
    endDate,
  });
}

function inDateRange(value, fromDate, toDate) {
  const date = toDateValue(value);
  if (!date) {
    return false;
  }

  if (fromDate && date < fromDate) {
    return false;
  }

  if (toDate && date > toDate) {
    return false;
  }

  return true;
}

function sortSalesDesc(sales = []) {
  return [...sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createSale(db, saleData, mainWindow, actor = null) {
  try {
    const securedSaleData = actor ? {
      ...saleData,
      storeNo: actor.storeNo,
      servedBy: actor._id,
      paid: false,
    } : saleData;
    const result = await postSale(db, securedSaleData, {
      mainWindow,
      actor,
      printReceipt: false,
      requireShiftOwner: false,
    });

    if (!result.success) {
      return result;
    }

    let journalEntry = null;
    let journalError = null;
    const warnings = [];

    try {
      const journalResult = await ensureJournalEntryForSale(db, result.sale);
      if (journalResult.success) {
        journalEntry = journalResult.journalEntry || null;
      } else {
        journalError = journalResult.error || 'Failed to create sale journal entry';
        warnings.push(journalError);
        console.error('Sale journal creation failed:', journalError);
      }
    } catch (error) {
      journalError = error.message || 'Failed to create sale journal entry';
      warnings.push(journalError);
      console.error('Sale journal creation failed:', error);
    }

    if (global.printer?.printer && global.printer?.device) {
      printReceipt(result.sale).catch((error) => {
        console.error('Receipt printing failed:', error);
      });
    }

    return {
      success: true,
      sale: decorateSale(result.sale),
      stockMovements: result.stockMovements,
      ledgerEntries: result.ledgerEntries,
      journalEntry,
      journalError,
      warnings,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getSaleProducts(db, saleId) {
  return db.get(saleId)
    .then((sale) => sale.items || [])
    .catch((error) => {
      console.error('Error fetching sale products:', error);
      return { success: false, error: error.message };
    });
}

async function getSalesByPaymentMethod(db, storeNo, date1, date2) {
  try {
    const fromDate = toDateValue(date1);
    const toDate = toDateValue(date2);
    const sales = (await getAllStoreSales(db, storeNo)).filter((sale) =>
      shouldIncludeSaleInMetrics(sale) && inDateRange(sale.createdAt, fromDate, toDate)
    );

    const groupedSales = {};

    for (const sale of sales) {
      const sign = sale.netTotalAmount < 0 ? -1 : 1;
      for (const payment of getSalePaymentBreakdown(sale)) {
        const paymentLabel = String(payment.method || payment.paymentMethod || sale.paymentMethod || 'Unknown').trim() || 'Unknown';
        const key = paymentLabel.toLowerCase();
        if (!groupedSales[key]) {
          groupedSales[key] = { pmethod: paymentLabel, sales: 0, totalAmount: 0 };
        }

        groupedSales[key].sales += 1;
        groupedSales[key].totalAmount = Number((groupedSales[key].totalAmount + (Math.abs(Number(payment.amount) || 0) * sign)).toFixed(2));
      }
    }

    return { success: true, data: Object.values(groupedSales) };
  } catch (error) {
    console.error('Error getting sales by payment method:', error);
    return { success: false, error: error.message };
  }
}

async function getTotalSales(db, storeNo, startDate, endDate) {
  try {
    const fromDate = toDateValue(startDate);
    const toDate = toDateValue(endDate);
    const sales = (await getAllStoreSales(db, storeNo)).filter((sale) =>
      shouldIncludeSaleInMetrics(sale) && inDateRange(sale.createdAt, fromDate, toDate)
    );

    const totalSales = Number(sales.reduce((sum, sale) => sum + sale.netTotalAmount, 0).toFixed(2));
    return { success: true, data: totalSales };
  } catch (error) {
    console.error('Error getting total sales:', error);
    return { success: false, error: error.message };
  }
}

async function getAverageTransactionValue(db, storeNo, startDate, endDate) {
  try {
    const fromDate = toDateValue(startDate);
    const toDate = toDateValue(endDate);
    const sales = (await getAllStoreSales(db, storeNo)).filter((sale) =>
      shouldIncludeSaleInMetrics(sale) && inDateRange(sale.createdAt, fromDate, toDate)
    );

    if (sales.length === 0) {
      return { success: true, data: 0 };
    }

    const total = sales.reduce((sum, sale) => sum + sale.netTotalAmount, 0);
    return { success: true, data: Number((total / sales.length).toFixed(2)) };
  } catch (error) {
    console.error('Error getting average transaction value:', error);
    return { success: false, error: error.message };
  }
}

async function getSalesByCategory(db, storeNo, startDate, endDate) {
  try {
    const fromDate = toDateValue(startDate);
    const toDate = toDateValue(endDate);
    const [sales, productsResult] = await Promise.all([
      getAllStoreSales(db, storeNo),
      db.find({
        selector: {
          type: 'product',
          state: 'Active',
          ...(storeNo ? { storeNo } : {}),
        },
        limit: 9999,
      }),
    ]);

    const productsById = new Map((productsResult.docs || []).map((product) => [product._id, product]));
    const categoryTotals = {};

    for (const sale of sales) {
      if (!shouldIncludeSaleInMetrics(sale) || !inDateRange(sale.createdAt, fromDate, toDate)) {
        continue;
      }

      for (const item of sale.items || []) {
        const category = productsById.get(item.productId)?.category || 'Uncategorized';
        categoryTotals[category] = Number(((categoryTotals[category] || 0) + getSaleNetItemSubtotal(item, sale)).toFixed(2));
      }
    }

    return { success: true, data: categoryTotals };
  } catch (error) {
    console.error('Error getting sales by category:', error);
    return { success: false, error: error.message };
  }
}

async function getTopSellingItems(db, storeNo, startDate, endDate, limit = 50) {
  try {
    const fromDate = toDateValue(startDate);
    const toDate = toDateValue(endDate);
    const sales = (await getAllStoreSales(db, storeNo)).filter((sale) =>
      shouldIncludeSaleInMetrics(sale) && inDateRange(sale.createdAt, fromDate, toDate)
    );

    const itemSales = {};
    for (const sale of sales) {
      for (const item of sale.items || []) {
        if (!item.productId) {
          continue;
        }

        if (!itemSales[item.productId]) {
          itemSales[item.productId] = {
            productId: item.productId,
            productName: item.name,
            quantity: 0,
            totalSales: 0,
          };
        }

        const quantityDelta = sale.saleType === 'RETURN SALE'
          ? -Math.abs(toNumber(item.quantity))
          : Math.abs(toNumber(item.quantity));

        itemSales[item.productId].quantity += quantityDelta;
        itemSales[item.productId].totalSales = Number((itemSales[item.productId].totalSales + getSaleNetItemSubtotal(item, sale)).toFixed(2));
      }
    }

    const sortedItems = Object.values(itemSales)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, limit);

    return { success: true, data: sortedItems };
  } catch (error) {
    console.error('Error getting top-selling items:', error);
    return { success: false, error: error.message };
  }
}

async function getGrossProfitMargin(db, storeNo, startDate, endDate) {
  try {
    const summary = await getTotalSalesRevenueAndProfit(db, storeNo, startDate, endDate);
    if (!summary.success) {
      return summary;
    }

    const revenue = toNumber(summary.data.totalRevenue);
    const profit = toNumber(summary.data.grossProfit);
    const margin = revenue === 0 ? 0 : Number(((profit / revenue) * 100).toFixed(2));

    return { success: true, data: margin };
  } catch (error) {
    console.error('Error calculating gross profit margin:', error);
    return { success: false, error: error.message };
  }
}

async function getTotalSalesRevenueAndProfit(db, storeNo, startDate, endDate) {
  try {
    const fromDate = toDateValue(startDate);
    const toDate = toDateValue(endDate);
    const sales = (await getAllStoreSales(db, storeNo)).filter((sale) =>
      shouldIncludeSaleInMetrics(sale) && inDateRange(sale.createdAt, fromDate, toDate)
    );

    const totalSales = sales.length;
    const totalRevenue = Number(sales.reduce((sum, sale) => sum + sale.netTotalAmount, 0).toFixed(2));
    const totalCost = Number(sales.reduce((sum, sale) => sum + getSaleNetCost(sale), 0).toFixed(2));
    const grossProfit = Number((totalRevenue - totalCost).toFixed(2));

    return {
      success: true,
      data: {
        totalSales,
        totalRevenue,
        grossProfit,
      },
    };
  } catch (error) {
    console.error('Error getting total sales, revenue, and profit:', error);
    return { success: false, error: error.message };
  }
}

async function getTopCustomers(db, storeNo, startDate, endDate, limit = 10) {
  try {
    const fromDate = toDateValue(startDate);
    const toDate = toDateValue(endDate);
    const [sales, customersResult] = await Promise.all([
      getAllStoreSales(db, storeNo),
      db.find({
        selector: {
          type: 'customer',
          state: 'Active',
          ...(storeNo ? { storeNo } : {}),
        },
        limit: 9999,
      }),
    ]);

    const customersById = new Map((customersResult.docs || []).map((customer) => [customer._id, customer]));
    const customerSales = {};

    for (const sale of sales) {
      if (!shouldIncludeSaleInMetrics(sale) || !inDateRange(sale.createdAt, fromDate, toDate)) {
        continue;
      }

      const customerId = getCurrentCustomerId(sale);
      if (!customerId) {
        continue;
      }

      if (!customerSales[customerId]) {
        customerSales[customerId] = {
          customerId,
          customerName: customersById.get(customerId)?.name || 'Unknown Customer',
          totalSales: 0,
          totalAmount: 0,
        };
      }

      customerSales[customerId].totalSales += 1;
      customerSales[customerId].totalAmount = Number((customerSales[customerId].totalAmount + sale.netTotalAmount).toFixed(2));
    }

    const sortedCustomers = Object.values(customerSales)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);

    return { success: true, data: sortedCustomers };
  } catch (error) {
    console.error('Error getting top customers:', error);
    return { success: false, error: error.message };
  }
}

async function getAllSalesBetweenDates(db, storeNo, startDate, endDate) {
  try {
    const sales = await findSales(db, {
      storeNo,
      state: 'Active',
      startDate,
      endDate,
    });

    return { success: true, data: sortSalesDesc(sales) };
  } catch (error) {
    console.error('Error getting sales between dates:', error);
    return { success: false, error: error.message };
  }
}

async function getFailedSalesBetweenDates(db, storeNo, startDate, endDate) {
  try {
    const sales = await getFailedStoreSales(db, storeNo, startDate, endDate);

    return { success: true, data: sortSalesDesc(sales) };
  } catch (error) {
    console.error('Error getting failed sales between dates:', error);
    return { success: false, error: error.message };
  }
}

function getSaleById(db, saleId) {
  return db.get(saleId)
    .then((sale) => ({ success: true, data: decorateSale(sale) }))
    .catch((error) => ({ success: false, error: error.message }));
}

function archiveSale(db, saleId) {
  return db.get(saleId)
    .then((sale) => {
      if ((sale.status || 'posted') === 'posted' || sale.status === 'partially_returned' || sale.status === 'fully_returned' || sale.status === 'reassigned' || sale.status === 'voided') {
        return { success: false, error: 'Posted sales can no longer be deleted. Use reconciliation instead.' };
      }

      sale.state = 'Inactive';
      sale.updatedAt = new Date().toISOString();
      return db.put(sale).then((response) => ({ success: true, sale: { _id: response.id, status: 'Inactive' } }));
    })
    .catch((error) => ({ success: false, error: error.message }));
}

async function getCashierSales(db, storeNo, staffId) {
  try {
    const fromDate = startOfDay();
    const toDate = endOfDay();
    const sales = (await getAllStoreSales(db, storeNo)).filter((sale) =>
      sale.servedBy === staffId && inDateRange(sale.createdAt, fromDate, toDate)
    );

    return { success: true, data: sortSalesDesc(sales) };
  } catch (error) {
    console.error('Error getting cashier sales:', error);
    return { success: false, error: error.message };
  }
}

async function getTodaySalesByPaidStatus(db, storeNo, paidStatus) {
  try {
    const fromDate = startOfDay();
    const toDate = endOfDay();
    const sales = await findSales(db, {
      storeNo,
      state: 'Active',
      startDate: fromDate,
      endDate: toDate,
      ...(paidStatus !== 'all' ? { paid: paidStatus === 'paid' } : {}),
    });

    return { success: true, data: sortSalesDesc(sales) };
  } catch (error) {
    console.error('Error getting sales by paid status:', error);
    return { success: false, error: error.message };
  }
}

async function getShiftSales(db, storeNo, registerSessionId) {
  try {
    if (!storeNo || !registerSessionId) {
      return { success: false, error: 'storeNo and registerSessionId are required' };
    }

    await ensureSalesHistoryIndex(db);
    const result = await findAll(db, {
      selector: {
        type: 'sale',
        state: 'Active',
        storeNo,
        registerSessionId,
      },
      use_index: [SHIFT_SALES_DDOC, SHIFT_SALES_INDEX],
    });

    return { success: true, data: sortSalesDesc(result.docs.map(decorateSale)) };
  } catch (error) {
    console.error('Error getting shift sales:', error);
    return { success: false, error: error.message };
  }
}

async function getUnpaidSalesBeforeToday(db, storeNo) {
  try {
    const beforeToday = startOfDay();
    const sales = await findSales(db, {
      storeNo,
      state: 'Active',
      paid: false,
      endDate: new Date(beforeToday.getTime() - 1),
    });

    return { success: true, data: sortSalesDesc(sales) };
  } catch (error) {
    console.error('Error getting unpaid sales before today:', error);
    return { success: false, error: error.message };
  }
}

async function getPendingSalesByMonth(db, storeNo, referenceDate = new Date()) {
  try {
    if (!storeNo) return { success: false, error: 'storeNo is required' };

    const reference = toDateValue(referenceDate) || new Date();
    const currentMonthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const nextMonthStart = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    const lastMonthStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
    const sales = await findSales(db, {
      storeNo,
      state: 'Active',
      paid: false,
      startDate: lastMonthStart,
      endDate: new Date(nextMonthStart.getTime() - 1),
    });

    return {
      success: true,
      data: {
        currentMonth: sortSalesDesc(sales.filter((sale) => toDateValue(sale.createdAt) >= currentMonthStart)),
        lastMonth: sortSalesDesc(sales.filter((sale) => toDateValue(sale.createdAt) < currentMonthStart)),
        ranges: {
          currentMonth: { start: currentMonthStart.toISOString(), end: new Date(nextMonthStart.getTime() - 1).toISOString() },
          lastMonth: { start: lastMonthStart.toISOString(), end: new Date(currentMonthStart.getTime() - 1).toISOString() },
        },
      },
    };
  } catch (error) {
    console.error('Error getting pending monthly sales:', error);
    return { success: false, error: error.message };
  }
}

async function updateSalePaidStatus(db, payload, actor = null) {
  const saleId = typeof payload === 'string' ? payload : payload?.saleId;
  const paidStatus = typeof payload === 'object' ? payload.paidStatus : true;
  try {
    if (!saleId || paidStatus !== true) {
      return { success: false, error: 'Payments can only be confirmed; posted confirmations cannot be undone.' };
    }
    const sale = await db.get(saleId);
    if (sale.paid === true) {
      return { success: true, sale, idempotent: true };
    }
    const session = await getOpenRegisterSession(db, sale.storeNo);
    if (!session) return { success: false, error: 'Open register first before confirming payment.' };
    if (actor) assertShiftOwner(session, actor);

    const moneyPayments = getSalePaymentBreakdown(sale).filter((payment) => normalizePaymentMethod(payment.method) !== 'CREDIT');
    if (moneyPayments.length === 0) {
      return { success: false, error: 'Credit sales are settled through a customer payment transaction, not Mark Paid.' };
    }
    const now = new Date().toISOString();
    const confirmationId = `${sale._id}:payment-confirmation`;
    const actorRef = buildActorReference(actor);
    const confirmation = {
      _id: confirmationId,
      type: 'sale-payment',
      state: 'Active',
      status: 'posting',
      storeNo: sale.storeNo,
      saleId: sale._id,
      originRegisterSessionId: sale.registerSessionId,
      registerSessionId: session._id,
      paymentBreakdown: moneyPayments,
      saleType: sale.saleType || 'NEW SALE',
      confirmedAt: now,
      confirmedBy: actorRef,
      createdAt: now,
      updatedAt: now,
    };
    await db.put(confirmation);

    const sign = sale.saleType === 'RETURN SALE' ? -1 : 1;
    for (let index = 0; index < moneyPayments.length; index += 1) {
      const payment = moneyPayments[index];
      const account = payment.accountId ? await db.get(payment.accountId).catch(() => null) : null;
      if (!account || account.type !== 'account' || account.state !== 'Active' || account.storeNo !== sale.storeNo) {
        throw new Error(`Cash or M-Pesa account is missing for ${payment.method}`);
      }
      const amount = Math.abs(Number(payment.amount) || 0);
      const fee = Math.abs(Number(payment.transactionCost) || 0);
      const delta = Number((sign < 0 ? -(amount + fee) : (amount - fee)).toFixed(2));
      await applyEntityBalanceDelta(db, 'account', account._id, delta);
      await recordLedgerEntry(db, {
        _id: `${confirmationId}:ledger:${index}`,
        storeNo: sale.storeNo,
        entityType: 'account',
        entityId: account._id,
        bucket: 'account_balance',
        delta,
        description: `Payment confirmed for sale ${sale._id}`,
        sourceDocType: 'sale-payment',
        sourceDocId: confirmationId,
        date: now,
        metadata: { registerSessionId: session._id, paymentMethod: normalizePaymentMethod(payment.method) },
      });
    }
    await ensureJournalEntryForSalePayment(db, confirmation);

    const currentSale = await db.get(sale._id);
    const updatedSale = {
      ...currentSale,
      paid: true,
      paidAt: now,
      paidBy: actorRef,
      paidRegisterSessionId: session._id,
      updatedAt: now,
    };
    await db.put(updatedSale);
    const currentConfirmation = await db.get(confirmationId);
    await db.put({ ...currentConfirmation, status: 'posted', updatedAt: now });
    return { success: true, sale: decorateSale(updatedSale), paymentConfirmation: { ...confirmation, status: 'posted' } };
  } catch (error) {
    console.error('Error confirming sale payment:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createSale,
  getSaleProducts,
  getSalesByPaymentMethod,
  getTotalSales,
  getAverageTransactionValue,
  getSalesByCategory,
  getTopSellingItems,
  getGrossProfitMargin,
  getTotalSalesRevenueAndProfit,
  getTopCustomers,
  getAllSalesBetweenDates,
  getFailedSalesBetweenDates,
  getSaleById,
  archiveSale,
  getCashierSales,
  getShiftSales,
  getTodaySalesByPaidStatus,
  getUnpaidSalesBeforeToday,
  getPendingSalesByMonth,
  updateSalePaidStatus,
};
