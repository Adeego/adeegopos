// Serialization of Realm objects
function serializeProduct(product) {
  return {
    _id: product._id,
    name: product.name,
    baseUnit: product.baseUnit,
    buyPrice: product.buyPrice,
    stock: product.stock,
    status: product.status,
    category: product.category,
    restockThreshold: product.restockThreshold,
    restockPeriod: product.restockPeriod,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    sku: product.sku,
    variants: product.variants.map(serializeProductVariant)
  };
}

function serializeProductVariant(variant) {
  return {
    _id: variant._id,
    name: variant.name,
    conversionFactor: variant.conversionFactor,
    unitPrice: variant.unitPrice,
    productId: variant.product._id  // Only include the product's ID
  };
}

module.exports = {
    serializeProduct,
    serializeProductVariant,
};