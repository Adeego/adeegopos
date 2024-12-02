// Function to generate a finance report for a specific date range
function incomeStatement(db, fromDate, toDate) {
  // Ensure dates are Date objects
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0); // Start of the day
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999); // End of the day

  // Promise for sales within the date range
  const salesPromise = db.find({
    selector: {
      createdAt: { 
        $gte: from.toISOString(), 
        $lte: to.toISOString() 
      },
      type: "sale",
      state: "Active"
    }
  });

  // Promise for expenses within the date range
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

  // Execute both promises concurrently
  return Promise.all([salesPromise, expensesPromise])
    .then(([salesResult, expensesResult]) => {
      // Calculate sales metrics
      let cashSales = 0;
      let mpesaSales = 0;
      let creditSales = 0;
      let totalCOGS = 0;

      // Process sales
      salesResult.docs.forEach(sale => {
        const totalAmount = Number(sale.totalAmount) || 0;
        
        // Categorize sales by payment method
        switch(sale.paymentMethod) {
          case 'CASH':
            cashSales += totalAmount;
            break;
          case 'MPESA':
            mpesaSales += totalAmount;
            break;
          case 'CREDIT':
            creditSales += totalAmount;
            break;
        }

        // Calculate COGS
        sale.items.forEach(item => {
          const quantity = Number(item.quantity) || 0;
          const buyPrice = Number(item.buyPrice) || 0;
          totalCOGS += quantity * buyPrice;
        });
      });

      // Calculate total sales
      const totalSales = Number((cashSales + mpesaSales + creditSales).toFixed(2));

      // Calculate expenses
      const expenses = {
        "Rent and Utilities": 0,
        "Salaries and Wages": 0,
        "Transport and Fuel": 0,
        "Maintenace and Repairs": 0,
        "Other Expense": 0
      };

      // Process expenses
      expensesResult.docs.forEach(expense => {
        const amount = Number(expense.amount) || 0;
        
        // Categorize expenses
        switch(expense.expenseType) {
          case 'Rent and Utilities':
            expenses["Rent and Utilities"] += amount;
            break;
          case 'Salaries and Wages':
            expenses["Salaries and Wages"] += amount;
            break;
          case 'Transport and Fuel':
            expenses["Transport and Fuel"] += amount;
            break;
          case 'Maintenace and Repairs':
            expenses["Maintenace and Repairs"] += amount;
            break;
          case 'Other Expense':
            expenses["Other Expense"] += amount;
        }
      });

      // Calculate total expenses
      const totalExpenses = Number(Object.values(expenses).reduce((sum, expense) => sum + expense, 0).toFixed(2));

      // Construct and return the finance report
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
            "rent&utilities": Number(expenses["Rent and Utilities"].toFixed(2)),
            "Salaries": Number(expenses["Salaries and Wages"].toFixed(2)),
            "transport&fuel": Number(expenses["Transport and Fuel"].toFixed(2)),
            "maintenance&repairs": Number(expenses["Maintenace and Repairs"].toFixed(2)),
            "otherExpenses": Number(expenses["Other Expense"].toFixed(2)),
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
  from.setHours(0, 0, 0, 0); // Start of the day
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999); // End of the day

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
      // Calculate total amount from transactions
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

function getBalanceSheet(db, fromDate, toDate) {
  // Ensure dates are Date objects
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0); // Start of the day
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999); // End of the day

  // Promise to find balance sheet entries and account entries
  const balanceSheetEntriesPromise = db.find({
      selector: {
        type: { $in: ["asset", "liability", "equity"] },
        state: "Active"
      }
  });

  const accountsPromise = db.find({
    selector: {
      type: "account",
      state: "Active"
    }
  });

  // Promise to find customers with negative balances
  const customersPromise = db.find({
    selector: {
      type: "customer",
      state: "Active"
    }
  });

  // Promise to find suppliers with positive balances
  const suppliersPromise = db.find({
    selector: {
      type: "supplier",
      state: "Active"
    }
  });

  // Promise to find all products
  const productsPromise = db.find({
    selector: {
      type: "product",
      state: "Active"
    }
  });

  // Promise to find prepaid expenses
  const prepaidExpensesPromise = db.find({
    selector: {
      type: "expense",
      state: "Active",
      createdAt: {
        $gte: from.toISOString(),
        $lte: to.toISOString()
        },
      date: {
        $gt: to.toISOString()
      }
    }
  });

  // Use Promise.all to run all queries concurrently
  return Promise.all([
    balanceSheetEntriesPromise, 
    accountsPromise, 
    customersPromise, 
    suppliersPromise,
    productsPromise,
    prepaidExpensesPromise
  ])
    .then(([
      balanceSheetResult, 
      accountsResult, 
      customersResult, 
      suppliersResult,
      productsResult,
      prepaidExpensesResult
    ]) => {
      // Initialize balance sheet structure
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

      // Calculate inventory value
      let inventoryValue = 0;
      productsResult.docs.forEach(product => {
        const variant = product.variants.find(v => v.conversionFactor === 1);
        if (variant) {
          inventoryValue += (Number(product.stock) || 0) * (Number(variant.unitPrice) || 0);
        }
    });
      balanceSheet.assets.inventory = Number(inventoryValue.toFixed(2));

      // Calculate prepaid expenses
      const prepaidExpensesTotal = prepaidExpensesResult.docs.reduce((sum, expense) => {
        return sum + (Number(expense.amount) || 0);
      }, 0);
      balanceSheet.assets.prepaidExpenses = Number(prepaidExpensesTotal.toFixed(2));

      // Calculate total of negative customer balances
      const negativeCustomerBalancesTotal = customersResult.docs
        .filter(customer => Number(customer.balance) < 0)
        .reduce((sum, customer) => {
          return sum + Math.abs(Number(customer.balance) || 0);
        }, 0);

      // Calculate total of positive supplier balances
      const positiveSupplierBalancesTotal = suppliersResult.docs
        .filter(supplier => Number(supplier.balance) > 0)
        .reduce((sum, supplier) => {
          return sum + (Number(supplier.balance) || 0);
        }, 0);

      // Add negative customer balances to accounts receivable
      balanceSheet.assets.accountsReceivable += Number(negativeCustomerBalancesTotal.toFixed(2));

      // Add positive supplier balances to accounts payable
      balanceSheet.liabilities.accountsPayable += Number(positiveSupplierBalancesTotal.toFixed(2));

      // Add account balances to cashAndBankBalances
      const accountBalances = accountsResult.docs.reduce((sum, account) => {
        return sum + (Number(account.balance) || 0);
      }, 0);

      balanceSheet.assets.cashAndBankBalances += Number(accountBalances.toFixed(2));

      // Process each balance sheet entry
      balanceSheetResult.docs.forEach(entry => {
        const amount = Number(entry.amount) || 0;

        // Map categories to balance sheet structure
        switch(entry.category) {
          // Assets
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
            balanceSheet.assets.fixedAssets -= amount; // Subtract depreciation
            break;

          // Liabilities
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

          // Equity
          case 'Owner\'s Capital':
            balanceSheet.equity.ownerCapital += amount;
            break;
          case 'Retained Earnings':
            balanceSheet.equity.retainedEarnings += amount;
            break;
}
      });

      // Calculate totals
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

      // Round all numbers to 2 decimal places
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

// Export the function
module.exports = {
  incomeStatement,
  getAccountStatement,
  getBalanceSheet
};
