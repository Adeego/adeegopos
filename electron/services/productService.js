const PouchDB = require('pouchdb');
const db = new PouchDB('products');

// Function to add a new product and its variants
function addNewProduct(productData) {
  return db.post(productData)
    .then(response => ({ success: true, product: { ...productData, _id: response.id, _rev: response.rev } }))
    .catch(error => {
      console.error('Error adding new product:', error);
      return { success: false, error: error.message };
    });
}

// Update a product
function updateProduct(productData) {
  return db.put(productData)
    .then(response => ({ success: true, product: { ...productData, _rev: response.rev } }))
    .catch(error => {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    });
}

// Added a new function for product search
function searchProducts(searchTerm) {
  return db.find({
    selector: { name: { $regex: `.*${searchTerm}.*` } }
  })
    .then(result => ({ success: true, products: result.docs }))
    .catch(error => {
      console.error('Error searching products:', error);
      return { success: false, error: error.message };
    });
}

// Get all saleItems related to a specific product
function getSaleItemsByProductId(productId, startDate, endDate) {
  return db.find({
    selector: {
      'productVariant.product._id': productId,
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }
  })
    .then(result => ({ success: true, saleItems: result.docs }))
    .catch(error => {
      console.error('Error fetching sale items for product:', error);
      return { success: false, error: error.message };
    });
}

// Delete a product
function deleteProduct(productId, rev) {
  return db.remove(productId, rev)
    .then(() => ({ success: true }))
    .catch(error => {
      console.error('Error deleting product:', error);
      return { success: false, error: error.message };
    });
}

function getAllProducts() {
  return db.allDocs({ include_docs: true })
    .then(result => ({ success: true, products: result.rows.map(row => row.doc) }))
    .catch(error => {
      console.error('Error fetching products:', error);
      return { success: false, error: error.message };
    });
}

function getProductById(productId) {
  return db.get(productId)
    .then(product => ({ success: true, product }))
    .catch(error => {
      console.error('Error fetching product:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  addNewProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  searchProducts,
  getSaleItemsByProductId,
};
