// Query all products for a specific supplier
function getSupplierProducts(realm, supplierId) {
  const supplier = realm.objectForPrimaryKey('Supplier', supplierId);
  return supplier.products;
}

module.exports = {
    getSupplierProducts
}