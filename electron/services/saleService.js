// Create a sale
function createSale(realm, saleData) {
  try {
    let newSale;
    realm.write(() => {
      const customer = realm.objectForPrimaryKey('Customer', saleData.customerId);
      newSale = realm.create('Sale', {
        _id: saleData._id,
        customer: customer,
        items: [],
        totalAmount: saleData.totalAmount,
        totalItems: saleData.totalItems,
        paymentMethod: saleData.paymentMethod,
        type: saleData.type,
        paid: saleData.paid,
        createdAt: saleData.createdAt,
        updatedAt: saleData.updatedAt,
      });

      saleData.items.forEach(itemData => {
        const productVariant = realm.objectForPrimaryKey('ProductVariant', itemData.productVariantId);
        const saleItem = realm.create('SaleItem', {
          _id: itemData._id,
          sale: newSale,
          productVariant: productVariant,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          subtotal: itemData.subtotal,
          discount: itemData.discount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        newSale.items.push(saleItem);

        // Update product stock
        const stockReduction = productVariant.conversionFactor * itemData.quantity;
        productVariant.product.stock -= stockReduction;
      });

      // Update customer balance if applicable
      if (!saleData.paid) {
        customer.balance += saleData.totalAmount;
      }

      // Add the sale to the customer's sales list
      customer.sales.push(newSale);
    });

    return { success: true, sale: newSale.toJSON() };
  } catch (error) {
    console.error('Error creating sale:', error);
    return { success: false, error: error.message };
  }
}

// Query all products in a specific sale
function getSaleProducts(realm, saleId) {
  const sale = realm.objectForPrimaryKey('Sale', saleId);
  return sale.products;
}

module.exports = {
    createSale,
    getSaleProducts,
};