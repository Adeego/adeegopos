const migrationFunction = (oldRealm, newRealm) => {
  if (oldRealm.schemaVersion < 9) {
    const schemas = [
      'WholeSaler',
      'Customer',
      'Product',
      'ProductVariant',
      'Supplier',
      'SaleItem',
      'Sale',
      'Staff'
    ];

    schemas.forEach(schemaName => {
      const oldObjects = oldRealm.objects(schemaName);

      for (let i = 0; i < oldObjects.length; i++) {
        newRealm.create(schemaName, {
          ...oldObjects[i],
          storeNo: '24091324'
        }, 'modified');
      }
    });
  }
};

module.exports = migrationFunction;