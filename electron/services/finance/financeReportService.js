const {
  getSaleMetricSign,
  getSaleNetAmount,
  getSalePaymentBreakdown,
  shouldIncludeSaleInMetrics,
  toNumber,
} = require('../postingService');

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function normalizeReportDate(value, fallback) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function getMonthlyReportSaleCost(sale = {}) {
  const sign = getSaleMetricSign(sale);

  if (!sign) {
    return 0;
  }

  const cost = (sale.items || []).reduce((sum, item) => {
    const quantity = Math.abs(toNumber(item.quantity));
    const buyPrice = toNumber(item.buyPrice);
    return sum + (quantity * buyPrice);
  }, 0);

  return roundMoney(cost * sign);
}

async function getMonthlyProfitLoss(db, options = {}) {
  try {
    const { storeNo, fromDate, toDate } = options;

    if (!storeNo) {
      return { success: false, error: 'storeNo is required' };
    }

    const now = new Date();
    const from = normalizeReportDate(fromDate, new Date(now.getFullYear(), now.getMonth(), 1));
    from.setHours(0, 0, 0, 0);

    const to = normalizeReportDate(toDate, new Date(now.getFullYear(), now.getMonth() + 1, 0));
    to.setHours(23, 59, 59, 999);

    const salesPromise = db.find({
      selector: {
        storeNo,
        type: 'sale',
        state: 'Active',
        createdAt: {
          $gte: from.toISOString(),
          $lte: to.toISOString(),
        },
      },
      limit: 100000,
    });

    const expensesPromise = db.find({
      selector: {
        storeNo,
        type: 'expense',
        state: 'Active',
        createdAt: {
          $gte: from.toISOString(),
          $lte: to.toISOString(),
        },
      },
      limit: 100000,
    });

    const expenseTypesPromise = db.find({
      selector: {
        storeNo,
        type: 'expenseType',
        state: 'Active',
      },
      limit: 100000,
    });

    const [salesResult, expensesResult, expenseTypesResult] = await Promise.all([
      salesPromise,
      expensesPromise,
      expenseTypesPromise,
    ]);

    const sales = {
      cashSales: 0,
      mpesaSales: 0,
      creditSales: 0,
      totalSales: 0,
    };
    let cogs = 0;

    (salesResult.docs || []).forEach((sale) => {
      if (!shouldIncludeSaleInMetrics(sale)) {
        return;
      }

      const sign = getSaleNetAmount(sale) < 0 ? -1 : 1;

      getSalePaymentBreakdown(sale).forEach((payment) => {
        const amount = roundMoney(Math.abs(toNumber(payment.amount)) * sign);
        const method = String(payment.method || 'CASH').toUpperCase();

        if (method === 'MPESA' || method === 'M-PESA' || method === 'PHONE') {
          sales.mpesaSales += amount;
        } else if (method === 'CREDIT') {
          sales.creditSales += amount;
        } else {
          sales.cashSales += amount;
        }
      });

      sales.totalSales += getSaleNetAmount(sale);
      cogs += getMonthlyReportSaleCost(sale);
    });

    const expensesByType = {};
    (expenseTypesResult.docs || []).forEach((expenseType) => {
      expensesByType[expenseType.name || 'Uncategorized'] = 0;
    });

    (expensesResult.docs || []).forEach((expense) => {
      const key = expense.expenseType || 'Uncategorized';
      expensesByType[key] = roundMoney((expensesByType[key] || 0) + toNumber(expense.amount));
    });

    const expenseBreakdown = Object.entries(expensesByType)
      .map(([expenseType, amount]) => ({
        expenseType,
        amount: roundMoney(amount),
      }))
      .sort((a, b) => a.expenseType.localeCompare(b.expenseType));

    const totalExpenses = roundMoney(expenseBreakdown.reduce((sum, item) => sum + item.amount, 0));
    const totalCogs = roundMoney(cogs);
    const grossProfit = roundMoney(sales.totalSales - totalCogs);
    const netProfit = roundMoney(grossProfit - totalExpenses);

    return {
      success: true,
      data: {
        period: {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
        },
        sales: {
          cashSales: roundMoney(sales.cashSales),
          mpesaSales: roundMoney(sales.mpesaSales),
          creditSales: roundMoney(sales.creditSales),
          totalSales: roundMoney(sales.totalSales),
        },
        cogs: totalCogs,
        grossProfit,
        expenses: {
          byType: expenseBreakdown,
          totalExpenses,
        },
        netProfit,
      },
    };
  } catch (error) {
    console.error('Error generating monthly P&L:', error);
    return { success: false, error: error.message };
  }
}

function incomeStatement(db, fromDate, toDate) {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);

  const salesPromise = db.find({
    selector: {
      createdAt: {
        $gte: from.toISOString(),
        $lte: to.toISOString()
      },
      type: "sale",
      state: "Active"
    },
    limit: 100000
  });

  const expensesPromise = db.find({
    selector: {
      createdAt: {
        $gte: from.toISOString(),
        $lte: to.toISOString()
      },
      type: "expense", 
      state: "Active"
    }
  });

  const expenseTypesPromise = db.find({
      selector: {
      type: "expenseType",
      state: "Active" 
    }
  });

  return Promise.all([salesPromise, expensesPromise, expenseTypesPromise])
    .then(([salesResult, expensesResult, expenseTypesResult]) => {
      let cashSales = 0;
      let mpesaSales = 0;
      let creditSales = 0;
      let totalCOGS = 0;

      console.log(salesResult.docs)

      salesResult.docs.forEach(sale => {
        const totalAmount = Number(sale.totalAmount) || 0;
        
        getSalePaymentBreakdown(sale).forEach((payment) => {
          const amount = Number(payment.amount) || 0;

          switch(payment.method) {
            case 'CASH':
              cashSales += amount;
              break;
            case 'MPESA':
              mpesaSales += amount;
              break;
            case 'CREDIT':
              creditSales += amount;
              break;
          }
        });

        sale.items.forEach(item => {
          const quantity = Number(item.quantity) || 0;
          const buyPrice = Number(item.buyPrice) || 0;
          totalCOGS += quantity * buyPrice;
        });
      });

      const totalSales = Number((cashSales + mpesaSales + creditSales).toFixed(2));

      const expenses = {};
      expenseTypesResult.docs.forEach(expenseType => {
        expenses[expenseType.name] = 0;
      });

      expensesResult.docs.forEach(expense => {
        const amount = Number(expense.amount) || 0;
        if (expenses.hasOwnProperty(expense.expenseType)) {
          expenses[expense.expenseType] += amount;
        }
      });

      const totalExpenses = Number(Object.values(expenses).reduce((sum, expense) => sum + expense, 0).toFixed(2));

      const formattedExpenses = {};
      Object.entries(expenses).forEach(([key, value]) => {
        const formattedKey = key.toLowerCase()
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
            if (+match === 0) return '';
            return index === 0 ? match.toLowerCase() : match.toUpperCase();
          });
        formattedExpenses[formattedKey] = Number(value.toFixed(2));
      });
      return {
        success: true,
        data: {
          sales: {
            cashSales: Number(cashSales.toFixed(2)),
            mpesaSales: Number(mpesaSales.toFixed(2)), 
            creditSales: Number(creditSales.toFixed(2)),
            totalSales: totalSales
          },
          cogs: Number(totalCOGS.toFixed(2)),
          expenses: {
            ...formattedExpenses,
            totalExpenses: totalExpenses
          }
        }
      };
    })
    .catch(error => {
      console.error('Error generating finance report:', error);
      return { success: false, error: error.message };
    });
}

function getAccountStatement(db, fromDate, toDate) {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);

  return db
    .find({
      selector: {
        createdAt: {
          $gte: from.toISOString(),
          $lte: to.toISOString()
        },
        type: "transaction",
        state: "Active"
      },
    })
    .then((result) => {
      const totalAmount = result.docs.reduce((sum, transaction) => {
        return sum + (Number(transaction.amount) || 0);
      }, 0);

      return {
        success: true,
        transactions: result.docs,
        totalAmount: Number(totalAmount.toFixed(2))
};
    })
    .catch((error) => ({ success: false, error: error.message }));
}

function getBalanceSheet(db, toDate) {
  const to = new Date(toDate);
  const balanceSheetEntriesPromise = db.find({
      selector: {
        type: { $in: ["asset", "liability", "equity"] },
      state: "Active",
      createdAt: {
        $lte: to.toISOString()
      }
    }
  });

  const invoicesPromise = db.find({
    selector: {
      type: "invoice",
      state: "Active",
      createdAt: {
        $lte: to.toISOString()
      }
    }
  });

  const accountsPromise = db.find({
    selector: {
      type: "account",
      state: "Active",
      createdAt: {
        $lte: to.toISOString()
      }
    }
  });

  const customersPromise = db.find({
    selector: {
      type: "customer",
      state: "Active",
      createdAt: {
        $lte: to.toISOString()
      }
    }
  });

  const productsPromise = db.find({
    selector: {
      type: "product",
      state: "Active",
      createdAt: {
        $lte: to.toISOString()
      }
    }
  });

  const prepaidExpensesPromise = db.find({
    selector: {
      type: "expense",
      state: "Active",
      createdAt: {
        $lte: to.toISOString()
        },
      date: {
        $gt: to.toISOString()
      }
    }
  });

  return Promise.all([
    balanceSheetEntriesPromise,
    accountsPromise,
    customersPromise,
    invoicesPromise,
    productsPromise,
    prepaidExpensesPromise
  ])
    .then(([
      balanceSheetResult,
      accountsResult,
      customersResult,
      invoicesResult,
      productsResult,
      prepaidExpensesResult
    ]) => {
      console.log(invoicesResult.docs);

      const balanceSheet = {
        assets: {
          cashAndBankBalances: 0,
          accountsReceivable: 0,
          inventory: 0,
          prepaidExpenses: 0,
          otherCurrentAssets: 0,
          fixedAssets: 0,
          totalCurrentAssets: 0,
          totalAssets: 0
        },
        liabilities: {
          accountsPayable: 0,
          shortTermLoans: 0,
          otherCurrentLiabilities: 0,
          longTermLoans: 0,
          totalCurrentLiabilities: 0,
          totalLiabilities: 0
        },
        equity: {
          ownerCapital: 0,
          retainedEarnings: 0,
          totalEquity: 0
        }
      };

      let inventoryValue = 0;
      productsResult.docs.forEach(product => {
        const variant = product.variants.find(v => v.conversionFactor === 1);
        if (variant) {
          inventoryValue += (Number(product.stock) || 0) * (Number(variant.unitPrice) || 0);
        }
    });
      balanceSheet.assets.inventory = Number(inventoryValue.toFixed(2));

      const prepaidExpensesTotal = prepaidExpensesResult.docs.reduce((sum, expense) => {
        return sum + (Number(expense.amount) || 0);
      }, 0);
      balanceSheet.assets.prepaidExpenses = Number(prepaidExpensesTotal.toFixed(2));

      const negativeCustomerBalancesTotal = customersResult.docs
        .filter(customer => Number(customer.balance) < 0)
        .reduce((sum, customer) => {
          return sum + Math.abs(Number(customer.balance) || 0);
        }, 0);

      // Calculate accounts payable from unpaid invoices
      const accountsPayableTotal = invoicesResult.docs
        .filter((invoice) => invoice.status !== 'voided')
        .reduce((sum, invoice) => {
          return sum + (Number(invoice.totalAmount) || 0);
        }, 0);

      balanceSheet.assets.accountsReceivable += Number(negativeCustomerBalancesTotal.toFixed(2));

      balanceSheet.liabilities.accountsPayable = Number(accountsPayableTotal.toFixed(2));

      const accountBalances = accountsResult.docs.reduce((sum, account) => {
        return sum + (Number(account.balance) || 0);
      }, 0);

      balanceSheet.assets.cashAndBankBalances += Number(accountBalances.toFixed(2));

      balanceSheetResult.docs.forEach(entry => {
        const amount = Number(entry.amount) || 0;

        switch(entry.category) {
          case 'Cash and Bank Balances':
            balanceSheet.assets.cashAndBankBalances += amount;
            break;
          case 'Accounts Receivable':
            balanceSheet.assets.accountsReceivable += amount;
            break;
          case 'Inventory':
            balanceSheet.assets.inventory += amount;
            break;
          case 'Prepaid Expenses':
            balanceSheet.assets.prepaidExpenses += amount;
            break;
          case 'Other Current Assets':
            balanceSheet.assets.otherCurrentAssets += amount;
            break;
          case 'Property & Equipment':
            balanceSheet.assets.fixedAssets += amount;
            break;
          case 'Accumulated Depreciation':
            balanceSheet.assets.fixedAssets -= amount;
            break;
          case 'Accounts Payable':
            balanceSheet.liabilities.accountsPayable += amount;
            break;
          case 'Short-Term Loans':
            balanceSheet.liabilities.shortTermLoans += amount;
            break;
          case 'Other Current Liabilities':
            balanceSheet.liabilities.otherCurrentLiabilities += amount;
            break;
          case 'Long-Term Loans':
            balanceSheet.liabilities.longTermLoans += amount;
            break;
          case 'Owner\'s Capital':
            balanceSheet.equity.ownerCapital += amount;
            break;
          case 'Retained Earnings':
            balanceSheet.equity.retainedEarnings += amount;
            break;
        }
      });

      balanceSheet.assets.totalCurrentAssets = Number((
        balanceSheet.assets.cashAndBankBalances +
        balanceSheet.assets.accountsReceivable +
        balanceSheet.assets.inventory +
        balanceSheet.assets.prepaidExpenses +
        balanceSheet.assets.otherCurrentAssets
      ).toFixed(2));

      balanceSheet.assets.totalAssets = Number((
        balanceSheet.assets.totalCurrentAssets +
        balanceSheet.assets.fixedAssets
      ).toFixed(2));

      balanceSheet.liabilities.totalCurrentLiabilities = Number((
        balanceSheet.liabilities.accountsPayable +
        balanceSheet.liabilities.shortTermLoans +
        balanceSheet.liabilities.otherCurrentLiabilities
      ).toFixed(2));

      balanceSheet.liabilities.totalLiabilities = Number((
        balanceSheet.liabilities.totalCurrentLiabilities +
        balanceSheet.liabilities.longTermLoans
      ).toFixed(2));

      balanceSheet.equity.totalEquity = Number((
        balanceSheet.equity.ownerCapital +
        balanceSheet.equity.retainedEarnings
      ).toFixed(2));

      Object.keys(balanceSheet.assets).forEach(key => {
        balanceSheet.assets[key] = Number(balanceSheet.assets[key].toFixed(2));
      });
      Object.keys(balanceSheet.liabilities).forEach(key => {
        balanceSheet.liabilities[key] = Number(balanceSheet.liabilities[key].toFixed(2));
      });
      Object.keys(balanceSheet.equity).forEach(key => {
        balanceSheet.equity[key] = Number(balanceSheet.equity[key].toFixed(2));
      });

      return {
        success: true,
        data: balanceSheet
      };
    })
    .catch(error => {
      console.error('Error generating balance sheet:', error);
      return { success: false, error: error.message };
    });
}

function getChartOfAccounts(db) {
  return db.find({
    selector: {
      type: { $in: ["expenseType"] },
      state: "Active" 
    }
  })
  .then(result => {
    const chartOfAccounts = {
      assets: {
        currentAssets: {
          code: "1100",
          accounts: {
            cash: { code: "1110", name: "Cash" },
            bankAccounts: { code: "1120", name: "Bank Accounts" },
            accountsReceivable: { code: "1130", name: "Accounts Receivable" },
            inventory: { code: "1140", name: "Inventory" },
            prepaidExpenses: { code: "1150", name: "Prepaid Expenses" }
          }
        },
        fixedAssets: {
          code: "1200", 
          accounts: {
            accumulatedDepreciation: { code: "1240", name: "Accumulated Depreciation" }
          }
        }
      },
      liabilities: {
        currentLiabilities: {
          code: "2100",
          accounts: {
            accountsPayable: { code: "2110", name: "Accounts Payable" },
            shortTermLoans: { code: "2120", name: "Short Term Loans" }
          }
        },
        longTermLiabilities: {
          code: "2200",
          accounts: {
            longTermLoans: { code: "2210", name: "Long Term Loans" }
          }
        }
      },
      equity: {
        code: "3000",
        accounts: {
          ownerCapital: { code: "3100", name: "Owner's Capital" },
          retainedEarnings: { code: "3200", name: "Retained Earnings" }
        }
      },
      revenue: {
        operatingRevenue: {
          code: "4100",
          accounts: {
            sales: { code: "4110", name: "Sales Revenue" }
          }
        }
      },
      expenses: {
        operatingExpenses: {
          code: "5100",
          accounts: {
            costOfGoodsSold: { code: "5110", name: "Cost of Goods Sold" }
          }
        }
      }
    };

    // Add expense types from database under operating expenses
    result.docs.forEach((expenseType, index) => {
      const code = `51${(index + 20).toString().padStart(2, '0')}`; // Generate codes starting from 5120
      chartOfAccounts.expenses.operatingExpenses.accounts[expenseType.name.toLowerCase()] = {
        code,
        name: expenseType.name
      };
    });

    return {
      success: true,
      data: chartOfAccounts
    };
  })
  .catch(error => {
    console.error('Error generating chart of accounts:', error);
    return { success: false, error: error.message };
  });
}

function getTrialBalance(db, fromDate, toDate) {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);

  const salesPromise = db.find({
    selector: {
      createdAt: {
        $gte: from.toISOString(),
        $lte: to.toISOString()
      },
      type: "sale",
      state: "Active"
    },
    limit: 100000
  });

  const expensesPromise = db.find({
    selector: {
      createdAt: {
        $gte: from.toISOString(),
        $lte: to.toISOString()
      },
      type: "expense",
      state: "Active"
    },
    limit: 100000
  });

  const expenseTypesPromise = db.find({
    selector: {
      type: "expenseType",
      state: "Active"
    },
    limit: 100000
  });

  const accountsPromise = db.find({
    selector: {
      type: "account",
      state: "Active"
    },
    limit: 100000
  });

  const customersPromise = db.find({
    selector: {
      type: "customer",
      state: "Active"
    },
    limit: 100000
  });

  const productsPromise = db.find({
    selector: {
      type: "product",
      state: "Active"
    },
    limit: 100000
  });

  const balanceSheetEntriesPromise = db.find({
    selector: {
      type: { $in: ["asset", "liability", "equity"] },
      state: "Active"
    },
    limit: 100000
  });

  const invoicesPromise = db.find({
    selector: {
      type: "invoice",
      state: "Active",
      createdAt: {
        $gte: from.toISOString(),
        $lte: to.toISOString()
      }
    },
    limit: 100000
  });

  return Promise.all([
    salesPromise,
    expensesPromise,
    expenseTypesPromise,
    accountsPromise,
    customersPromise,
    productsPromise,
    balanceSheetEntriesPromise,
    getChartOfAccounts(db),
    invoicesPromise
  ])
    .then(([
      salesResult,
      expensesResult,
      expenseTypesResult,
      accountsResult,
      customersResult,
      productsResult,
      balanceSheetResult,
      chartOfAccounts,
      invoicesResult
    ]) => {
      if (!chartOfAccounts.success) {
        throw new Error('Failed to get chart of accounts');
      }

      const trialBalance = {
        accounts: [],
        totalDebits: 0,
        totalCredits: 0
      };

      const addToTrialBalance = (code, name, debitAmount = 0, creditAmount = 0) => {
        trialBalance.accounts.push({
          code,
          name,
          debit: Number(debitAmount.toFixed(2)),
          credit: Number(creditAmount.toFixed(2))
        });
        trialBalance.totalDebits += Number(debitAmount.toFixed(2));
        trialBalance.totalCredits += Number(creditAmount.toFixed(2));
      };

      // Cash and Bank Accounts
      const cashAndBank = accountsResult.docs.reduce((sum, account) => 
        sum + (Number(account.balance) || 0), 0);
      if (cashAndBank > 0) {
        addToTrialBalance('1110', 'Cash and Bank', cashAndBank, 0);
      } else {
        addToTrialBalance('1110', 'Cash and Bank', 0, Math.abs(cashAndBank));
      }

      // Accounts Receivable
      const accountsReceivable = customersResult.docs
        .filter(customer => Number(customer.balance) < 0)
        .reduce((sum, customer) => 
          sum + Math.abs(Number(customer.balance) || 0), 0);
      addToTrialBalance('1130', 'Accounts Receivable', accountsReceivable, 0);

      // Inventory
      const inventoryValue = productsResult.docs.reduce((sum, product) => {
        const variant = product.variants.find(v => v.conversionFactor === 1);
        return variant ? 
          sum + ((Number(product.stock)) * (Number(variant.unitPrice))) : 
          sum;
      }, 0);
      addToTrialBalance('1140', 'Inventory', inventoryValue, 0);

      // Sales and COGS
      let totalSales = 0;
      let totalCOGS = 0;

      salesResult.docs.forEach(sale => {
        totalSales += Number(sale.totalAmount) || 0;
        sale.items.forEach(item => {
          totalCOGS += (Number(item.quantity) || 0) * (Number(item.buyPrice) || 0);
        });
      });

      addToTrialBalance('4110', 'Sales Revenue', 0, totalSales);
      addToTrialBalance('5110', 'Cost of Goods Sold', totalCOGS, 0);

      // Group expenses by expense type
      const expensesByType = {};
      expenseTypesResult.docs.forEach(type => {
        expensesByType[type.name] = 0;
      });

      expensesResult.docs.forEach(expense => {
        const amount = Number(expense.amount) || 0;
        if (expensesByType.hasOwnProperty(expense.expenseType)) {
          expensesByType[expense.expenseType] += amount;
        }
      });

      // Add grouped expenses to trial balance
      Object.entries(expensesByType).forEach(([expenseType, amount], index) => {
        if (amount > 0) {
          const code = `51${(index + 20).toString().padStart(2, '0')}`;
          addToTrialBalance(code, expenseType, amount, 0);
        }
      });

      // Calculate total invoices amount
      const totalInvoicesAmount = invoicesResult.docs
        .filter((invoice) => invoice.status !== 'voided')
        .reduce((sum, invoice) => {
          return sum + (Number(invoice.totalAmount) || 0);
        }, 0);

      // Process balance sheet entries
      balanceSheetResult.docs.forEach(entry => {
        const amount = Number(entry.amount) || 0;
        switch(entry.category) {
          case 'Property & Equipment':
            addToTrialBalance('1200', 'Fixed Assets', amount, 0);
            break;
          case 'Accounts Payable':
            addToTrialBalance('2110', 'Accounts Payable', 0, amount);
            break;
          case 'Short-Term Loans':
            addToTrialBalance('2120', 'Short Term Loans', 0, amount);
            break;
          case 'Long-Term Loans':
            addToTrialBalance('2210', 'Long Term Loans', 0, amount);
            break;
          case 'Owner\'s Capital':
            addToTrialBalance('3100', 'Owner\'s Capital', 0, amount);
            break;
          case 'Retained Earnings':
            addToTrialBalance('3200', 'Retained Earnings', 0, amount);
            break;
        }
      });

      // Add total invoices amount to Accounts Payable
      addToTrialBalance('2110', 'Accounts Payable', 0, totalInvoicesAmount);

      // Sort accounts by code and round totals
      trialBalance.accounts.sort((a, b) => a.code.localeCompare(b.code));
      trialBalance.totalDebits = Number(trialBalance.totalDebits.toFixed(2));
      trialBalance.totalCredits = Number(trialBalance.totalCredits.toFixed(2));

      return {
        success: true,
        data: trialBalance
      };
    })
    .catch(error => {
      console.error('Error generating trial balance:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  getMonthlyProfitLoss,
  incomeStatement,
  getAccountStatement,
  getBalanceSheet,
  getChartOfAccounts,
  getTrialBalance
};
