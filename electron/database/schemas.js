const CustomerSchema = {
  name: 'Customer',
  properties: {
    _id: 'string',
    name: { type: 'string', indexed: 'full-text' },
    phoneNumber: { type: 'string', indexed: 'full-text' },
    address: { type: 'string', indexed: 'full-text' },
    balance: 'int',
    credit: 'bool',
    status: 'string',
    sales: 'Sale[]' // One-to-many relationship with Sales
  },
  primaryKey: '_id',
};

const ProductSchema = {
  name: 'Product',
  properties: {
    _id: 'string',
    name: { type: 'string', indexed: 'full-text' },
    baseUnit: 'string', // e.g., 'kg' for sugar
    buyPrice: 'double', // Price at which the product was bought
    stock: 'double', // Total stock in base units
    variants: 'ProductVariant[]',
    status: 'string',
    category: 'string',
    restockThreshold: 'int', // Minimum stock level to trigger a restock alert
    restockPeriod: 'int', // Days after which the product is restocked
    createdAt: 'date',
    updatedAt: 'date',
    sku: 'string?', // Stock Keeping Unit
  },
  primaryKey: '_id',
};

const ProductVariantSchema = {
  name: 'ProductVariant',
  properties: {
    _id: 'string',
    product: 'Product',
    name: 'string', // e.g., '1kg', 'Half bag', 'Full bag'
    conversionFactor: 'double', // How many base units this variant represents
    unitPrice: 'double',
  },
  primaryKey: '_id',
};

const SupplierSchema = {
  name: 'Supplier',
  properties: {
    _id: 'string',
    name: 'string',
    contact: 'string',
    products: 'Product[]' // One-to-many relationship with Products
  },
  primaryKey: '_id',
};

const SaleItemSchema = {
  name: 'SaleItem',
  properties: {
    _id: 'string',
    sale: 'Sale',
    productVariant: 'ProductVariant',
    quantity: 'int',
    unitPrice: 'double',
    subtotal: 'double',
    discount: 'double',
    createdAt: 'date',
    updatedAt: 'date',
  },
  primaryKey: '_id',
};

const SaleSchema = {
  name: 'Sale',
  properties: {
    _id: 'string',
    customer: 'Customer',
    items: 'SaleItem[]', // One-to-many relationship with SaleItems
    totalAmount: 'double',
    totalItems: 'int',
    paymentMethod: 'string',
    type: 'string', // New Sale or Return Sale
    paid: 'bool',
    createdAt: 'date',
    updatedAt: 'date',
  },
  primaryKey: '_id',
};
module.exports = {
  CustomerSchema,
  ProductSchema,
  ProductVariantSchema,
  SupplierSchema,
  SaleItemSchema,
  SaleSchema,
};