const { net } = require('electron');
const customerService = require('./services/customerService')
const productService = require('./services/productService')
const wholeSalerService = require('./services/wholeSalerService')
const staffService = require('./services/staffService')
const saleService = require('./services/saleService')
const supplierService = require('./services/supplierService')
const { openPouchDB } = require('./pouchSync');

function getSyncStatus(db) {
  return db.info()
    .then(info => ({ isSyncing: true, progress: info.update_seq }))
    .catch(error => ({ isSyncing: false, error: error.message }));
}

function checkNetworkConnection() {
  return new Promise((resolve) => {
    const request = net.request('https://www.google.com');
    request.on('response', () => {
      resolve(true);
    });
    request.on('error', () => {
      resolve(false);
    });
    request.end();
  });
}

function setupIpcHandlers(ipcMain, db) {
  ipcMain.handle('get-online-status', async () => {
    const result = await checkNetworkConnection();
    return result
  });

  // Add this new IPC handler for getting sync status
  ipcMain.handle('get-sync-status', async () => {
    return getSyncStatus(db);
  });

  // Add this new IPC handler for staff sign-in
  ipcMain.handle('sign-in-staff', async (event, phoneNumber, passcode) => {
    return staffService.signInStaff(db, phoneNumber, passcode);
  });
    // Added new IPC handler for customer search
  ipcMain.handle('search-customers', async (event, name) => {
    return customerService.searchCustomers(db, name);
  });

  // Added new IPC handler for product search
  ipcMain.handle('search-products', async (event, searchTerm) => {
    return productService.searchProducts(db, searchTerm);
  });

  // Set up IPC handlers for Realm operations
  ipcMain.handle('realm-operation', async (event, operation, ...args) => {
    switch (operation) {
      case 'createCustomer':
        return customerService.createCustomer(db, args[0]);
      case 'updateCustomer':
        return customerService.updateCustomer(db, args[0]);
      case 'deleteCustomer':
        return customerService.deleteCustomer(db, args[0]);
      case 'getAllCustomers':
        return customerService.getAllCustomers(db);
      case 'getCustomerById':
        return customerService.getCustomerById(db, args[0]);
      case 'getAllProducts':
        return productService.getAllProducts(db);
      case 'getSaleItemsByProductId':
        return productService.getSaleItemsByProductId(db, args[0], args[1], args[2]);
      case 'getProductById':
        return productService.getProductById(db, args[0]);
      case 'updateProduct':
        return productService.updateProduct(db, args[0]);
      case 'addNewProduct':
        return productService.addNewProduct(db, args[0]);
      case 'deleteProduct':
        return productService.deleteProduct(db, args[0]);
      case 'createSale':
        return saleService.createSale(db, ...args);
      case 'getSupplierProducts':
        return getSupplierProducts(db, ...args).map(product => product.toJSON());
      case 'getCustomerSales':
        return customerService.getCustomerSales(db, ...args).map(sale => sale.toJSON());
      case 'getSaleProducts':
        return saleService.getSaleProducts(db, ...args).map(product => product.toJSON());
      case 'getSalesByPaymentMethod':
        return saleService.getSalesByPaymentMethod(db, args[0], args[1]);
      case 'getTotalSales':
        return saleService.getTotalSales(db, args[0], args[1]);
      case 'getAverageTransactionValue':
        return saleService.getAverageTransactionValue(db, args[0], args[1]);
      case 'getSalesByCategory':
        return saleService.getSalesByCategory(db, args[0], args[1]);
      case 'getTopSellingItems':
        return saleService.getTopSellingItems(db, args[0], args[1], args[2]);
      case 'getGrossProfitMargin':
        return saleService.getGrossProfitMargin(db, args[0], args[1]);
      case 'createWholeSaler':
        return wholeSalerService.createWholeSaler(db, args[0]);
      case 'updateWholeSaler':
        return wholeSalerService.updateWholeSaler(db, args[0]);
      case 'deleteWholeSaler':
        return wholeSalerService.deleteWholeSaler(db, args[0]);
      case 'getWholeSalerById':
        return wholeSalerService.getWholeSalerById(db, args[0]);
      case 'getAllWholeSalers':
        return wholeSalerService.getAllWholeSalers(db);
      case 'createStaff':
        return staffService.createStaff(db, args[0]);
      case 'updateStaff':
        return staffService.updateStaff(db, args[0]);
      case 'deleteStaff':
        return staffService.deleteStaff(db, args[0]);
      case 'getStaffById':
        return staffService.getStaffById(db, args[0]);
      case 'getAllStaff':
        return staffService.getAllStaff(db);
      case 'getTotalSalesRevenueAndProfit':
        return saleService.getTotalSalesRevenueAndProfit(db, args[0], args[1]);
      case 'getTopCustomers':
        return saleService.getTopCustomers(db, args[0], args[1], args[2]);
      case 'getAllSalesBetweenDates':
        return saleService.getAllSalesBetweenDates(db, args[0], args[1]);
      case 'getSaleById':
        return saleService.getSaleById(db, args[0]);
      // Add other operations as needed
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  });
}

module.exports = setupIpcHandlers
