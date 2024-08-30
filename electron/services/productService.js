const { serializeProduct } = require('../serializers');

// Function to add a new product and its variants
function addNewProduct(realm, productData) {
  try {
    let newProduct;
    realm.write(() => {
      // Create the main product
      newProduct = realm.create('Product', {
        _id: productData._id,
        name: productData.name,
        baseUnit: productData.baseUnit,
        buyPrice: productData.buyPrice,
        stock: productData.stock,
        variants: [],
        status: productData.status,
        category: productData.category,
        restockThreshold: productData.restockThreshold,
        restockPeriod: productData.restockPeriod,
        createdAt: productData.createdAt,
        updatedAt: productData.updatedAt,
        sku: productData.sku,
      });

      // Create and add variants
      productData.variants.forEach(variantData => {
        const newVariant = realm.create('ProductVariant', {
          _id: variantData._id,
          product: newProduct,
          name: variantData.name,
          conversionFactor: variantData.conversionFactor,
          unitPrice: variantData.unitPrice,
        });
        newProduct.variants.push(newVariant);
      });
    });

    return { success: true, product: newProduct.toJSON() };
  } catch (error) {
    console.error('Error adding new product:', error);
    return { success: false, error: error.message };
  }
}

// Update a product
function updateProduct(realm, productData) {
  try {
    let updatedProduct;
    realm.write(() => {
      updatedProduct = realm.create('Product', productData, 'modified');
    });
    return { success: true, product: updatedProduct.toJSON() };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
}

// Added a new function for product search
function searchProducts(realm, searchTerm) {
  try {
    const products = realm.objects('Product');
    const searchResults = products.filtered('name CONTAINS[c] $0', searchTerm);
    return { 
      success: true, 
      products: searchResults.map(product => product.toJSON()) 
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return { success: false, error: error.message };
  }
}

// Get all saleItems related to a specific prodcut
function getSaleItemsByProductId(realm, productId) {
  try {
    const saleItems = realm.objects('SaleItem');
    
    // Filter SaleItems where the productVariant's product matches the given productId
    const filteredSaleItems = saleItems.filtered('productVariant.product._id == $0', productId);
    
    return { 
      success: true, 
      saleItems: filteredSaleItems.map(saleItem => ({
        _id: saleItem._id,
        productVariantName: saleItem.productVariant.name,
        quantity: saleItem.quantity,
        unitPrice: saleItem.unitPrice,
        subtotal: saleItem.subtotal,
        discount: saleItem.discount,
        createdAt: saleItem.createdAt,
        updatedAt: saleItem.updatedAt,
      })) 
    };
  } catch (error) {
    console.error('Error fetching sale items for product:', error);
    return { success: false, error: error.message };
  }
}

// Delete a product
function deleteProduct(realm, productId) {
  try {
    let result;
    realm.write(() => {
      const productToDelete = realm.objectForPrimaryKey('Product', productId);

      if (productToDelete) {
        realm.delete(productToDelete);
        console.log(`Product with ID ${productId} has been successfully deleted.`);
        result = { success: true };
      } else {
        console.warn(`Product with ID ${productId} not found.`);
        result = { success: false, error: 'Customer not found' };
      }
    });
    return result; // Return the result object
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }
}

function getAllProducts(realm) {
  try {
    const products = realm.objects('Product');
    return {
      success: true,
      products: products.map(product => product.toJSON())  
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { success: false, error: error.message };
  }
}
//{/*Array.from(products).map(serializeProduct) */}

function getProductById(realm, productId) {
  try {
    const product = realm.objectForPrimaryKey('Product', productId);
    return product ? { success: true, product: serializeProduct(product) } : { success: false, error: 'Product not found' };
  } catch (error) {
    console.error('Error fetching product:', error);
    return { success: false, error: error.message };
  }
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