const customerService = require('./services/customerService')
const productService = require('./services/productService')
const wholeSalerService = require('./services/wholeSalerService')
const staffService = require('./services/staffService')
const saleService = require('./services/saleService')
const supplierService = require('./services/supplierService')

function setupIpcHandlers(ipcMain, realm) {
    // Added new IPC handler for customer search
  ipcMain.handle('search-customers', async (event, name) => {
    return customerService.searchCustomers(realm, name);
  });

  // Added new IPC handler for product search
  ipcMain.handle('search-products', async (event, searchTerm) => {
    return productService.searchProducts(realm, searchTerm);
  });

  // Set up IPC handlers for Realm operations
  ipcMain.handle('realm-operation', async (event, operation, ...args) => {
    switch (operation) {
      case 'createCustomer':
      return customerService.createCustomer(realm, args[0]);
      case 'updateCustomer':
        return customerService.updateCustomer(realm, args[0]);
      case 'deleteCustomer':
        return customerService.deleteCustomer(realm, args[0]);
      case 'getAllCustomers':
        return customerService.getAllCustomers(realm);
      case 'getCustomerById':
        return customerService.getCustomerById(realm, args[0]);
      case 'getAllProducts':
        return productService.getAllProducts(realm);
      case 'getSaleItemsByProductId':
        return productService.getSaleItemsByProductId(realm, args[0], args[1], args[2]);
      case 'getProductById':
        return productService.getProductById(realm, args[0]);
      case 'updateProduct':
        return productService.updateProduct(realm, args[0]);
      case 'addNewProduct':
        return productService.addNewProduct(realm, args[0]);
      case 'deleteProduct':
        return productService.deleteProduct(realm, args[0]);
      case 'createSale':
        return saleService.createSale(realm, ...args);
      case 'getSupplierProducts':
        return getSupplierProducts(realm, ...args).map(product => product.toJSON());
      case 'getCustomerSales':
        return customerService.getCustomerSales(realm, ...args).map(sale => sale.toJSON());
      case 'getSaleProducts':
        return saleService.getSaleProducts(realm, ...args).map(product => product.toJSON());
      case 'getSalesByPaymentMethod':
        return saleService.getSalesByPaymentMethod(realm, args[0], args[1]);
      case 'getTotalSales':
        return saleService.getTotalSales(realm, args[0], args[1]);
      case 'getAverageTransactionValue':
        return saleService.getAverageTransactionValue(realm, args[0], args[1]);
      case 'getSalesByCategory':
        return saleService.getSalesByCategory(realm, args[0], args[1]);
      case 'getTopSellingItems':
        return saleService.getTopSellingItems(realm, args[0], args[1], args[2]);
      case 'getGrossProfitMargin':
        return saleService.getGrossProfitMargin(realm, args[0], args[1]);
      case 'createWholeSaler':
        return wholeSalerService.createWholeSaler(realm, args[0]);
      case 'updateWholeSaler':
        return wholeSalerService.updateWholeSaler(realm, args[0]);
      case 'deleteWholeSaler':
        return wholeSalerService.deleteWholeSaler(realm, args[0]);
      case 'getWholeSalerById':
        return wholeSalerService.getWholeSalerById(realm, args[0]);
      case 'getAllWholeSalers':
        return wholeSalerService.getAllWholeSalers(realm);
      case 'createStaff':
        return staffService.createStaff(realm, args[0]);
      case 'updateStaff':
        return staffService.updateStaff(realm, args[0]);
      case 'deleteStaff':
        return staffService.deleteStaff(realm, args[0]);
      case 'getStaffById':
        return staffService.getStaffById(realm, args[0]);
      case 'getAllStaff':
        return staffService.getAllStaff(realm);
      case 'getTotalSalesRevenueAndProfit':
        return saleService.getTotalSalesRevenueAndProfit(realm, args[0], args[1])
      // Add other operations as needed
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  });
}

module.exports = setupIpcHandlers
