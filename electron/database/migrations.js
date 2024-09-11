const migrationFunction = (oldRealm, newRealm) => {
  if (oldRealm.schemaVersion < 8) {
    // const oldObjects = oldRealm.objects('WholeSaler');
    // const newObjects = newRealm.objects('WholeSaler');

    // // Loop through all objects and migrate/update as needed
    // for (let i = 0; i < oldObjects.length; i++) {
    //   const oldObject = oldObjects[i];
    //   const newObject = newObjects[i];

    //   // Migrate existing properties
    //   newObject._id = oldObject._id;
    //   newObject.name = oldObject.name;
    //   newObject.phone = oldObject.phone;
    //   newObject.location = oldObject.location;
    //   newObject.subscription = oldObject.subscription;
    //   newObject.plan = oldObject.plan;
    //   newObject.ends = oldObject.ends;
    //   newObject.createdAt = oldObject.createdAt;
    //   newObject.updatedAt = oldObject.updatedAt;
    // }
    // Migration from initial schema (version 0) to version 1
    // const oldCustomers = oldRealm.objects('Customer');
    // const oldProducts = oldRealm.objects('Product');
    // const oldSuppliers = oldRealm.objects('Supplier');
    // const oldSales = oldRealm.objects('Sale');
    // const oldSaleItems = oldRealm.objects('SaleItem');

    // Migrate Customer objects
    // for (const oldCustomer of oldCustomers) {
    //   newRealm.create('Customer', {
    //     _id: 'string', // Keep the existing string ID
    //     name: oldCustomer.name,
    //     phoneNumber: 'string',
    //     address: oldCustomer.address,
    //     balance: oldCustomer.balance,
    //     credit: oldCustomer.credit,
    //     status: 'string',
    //     // We'll handle the sales relationship later
    //   });
    // }

    // Migrate Product objects
    // for (const oldProduct of oldProducts) {
    //   newRealm.create('Product', {
    //     _id: 'string', // Keep the existing string ID
    //     name: oldProduct.name,
    //     baseUnit: oldProduct.baseUnit,
    //     buyPrice: oldProduct.buyPrice,
    //     stock: oldProduct.stock,
    //     status: oldProduct.status,
    //     category: oldProduct.category,
    //     restockThreshold: oldProduct.restockThreshold,
    //     restockPeriod: oldProduct.restockPeriod,
    //     createdAt: oldProduct.createdAt,
    //     updatedAt: oldProduct.updatedAt,
    //     sku: oldProduct.sku,
    //     // We'll handle the sales relationship later
    //   });
    // }

    // // Migrate Supplier objects
    // for (const oldSupplier of oldSuppliers) {
    //   newRealm.create('Supplier', {
    //     _id: 'string', // Keep the existing string ID
    //     name: oldSupplier.name,
    //     contact: oldSupplier.contact,
    //     // We'll handle the products relationship later
    //   });
    // }

    // Migrate SaleItem objects
    // for (const oldSaleItem of oldSaleItems) {
    //   newRealm.create('SaleItem', {
    //     _id: 'string', // Keep the existing string ID
    //     sale: newRealm.objectForPrimaryKey('Sale', oldSaleItem.sale._id),
    //     productVariant: newRealm.objectForPrimaryKey('ProductVariant', oldSaleItem.productVariant._id),
    //     quantity: oldSaleItem.quantity,
    //     unitPrice: oldSaleItem.unitPrice,
    //     subtotal: oldSaleItem.subtotal,
    //     discount: oldSaleItem.discount,
    //     createdAt: oldSaleItem.createdAt,
    //     updatedAt: oldSaleItem.updatedAt,
    //   });
    // }

    // Migrate Sale objects
    // for (const oldSale of oldSales) {
    //   newRealm.create('Sale', {
    //     _id: oldSale._id, // Keep the existing string ID
    //     customer: newRealm.objectForPrimaryKey('Customer', oldSale.customer._id),
    //     items: oldSale.items.map(p => newRealm.objectForPrimaryKey('SaleItem', p._id)),
    //     totalAmount: oldSale.totalAmount,
    //     totalItems: oldSale.totalItems,
    //     paymentMethod: oldSale.paymentMethod,
    //     type: oldSale.type,
    //     paid: oldSale.paid,
    //     createdAt: oldSale.createdAt,
    //     updatedAt: oldSale.updatedAt,
    //   });
    // }

    // Update relationships
    // for (const newCustomer of newRealm.objects('Customer')) {
    //   newCustomer.sales = oldRealm.objectForPrimaryKey('Customer', newCustomer._id).sales.map(s => 
    //     newRealm.objectForPrimaryKey('Sale', s._id)
    //   );
    // }

    // const newCustomers = newRealm.objects('Customer');
    // newCustomers.forEach(customer => {
    //   // No need to modify data, just ensuring all products are processed
    //   customer.name = customer.name;
    //   customer.phoneNumber = customer.phoneNumber;
    //   customer.address = customer.address;
    // });

    // Migration to add full-text search index
    // const newProducts = newRealm.objects('Product');
    // newProducts.forEach(product => {
    //   // No need to modify data, just ensuring all products are processed
    //   product.name = product.name;
    // });

    // for (const newProduct of newRealm.objects('Product')) {
    //   newProduct.sales = oldRealm.objectForPrimaryKey('Product', newProduct._id).sales.map(s => 
    //     newRealm.objectForPrimaryKey('Sale', s._id)
    //   );
    // }

    // for (const newSupplier of newRealm.objects('Supplier')) {
    //   newSupplier.products = oldRealm.objectForPrimaryKey('Supplier', newSupplier._id).products.map(p => 
    //     newRealm.objectForPrimaryKey('Product', p._id)
    //   );
    // }
  }
};

module.exports = migrationFunction;