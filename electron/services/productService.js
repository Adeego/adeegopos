function addNewProduct(db, productData) {
  const product = {
    _id: productData._id,
    type: "product",
    name: productData.name,
    uom: productData.uom,
    buyPrice: productData.buyPrice,
    stock: productData.stock,
    variants: productData.variants.map((variant) => ({
      _id: variant._id,
      productId: productData._id,
      name: variant.name,
      conversionFactor: variant.conversionFactor,
      unitPrice: variant.unitPrice,
      storeNo: variant.storeNo,
    })),
    status: productData.status,
    restockThreshold: productData.restockThreshold,
    restockPeriod: productData.restockPeriod,
    restock: productData.restock,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    barCode: productData.barCode || null,
    storeNo: productData.storeNo,
    state: "Active"
  };
  return db
    .put(product)
    .then((response) => ({
      success: true,
      product: { _id: response.id, ...product },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update a product
function updateProduct(db, productData) {
  return db
    .get(productData._id)
    .then((existingProduct) => {
      // Update the existing product with the new data
      const updatedProduct = {
        ...existingProduct,
        name: productData.name ?? existingProduct.name,
        baseUnit: productData.baseUnit ?? existingProduct.baseUnit,
        buyPrice: productData.buyPrice ?? existingProduct.buyPrice,
        stock: productData.stock ?? existingProduct.stock,
        variants: (productData.variants
          ? productData.variants.map((variant) => ({
              _id: variant._id,
              productId: productData._id,
              name: variant.name,
              conversionFactor: variant.conversionFactor,
              unitPrice: variant.unitPrice,
              storeNo: variant.storeNo,
            }))
          : existingProduct.variants),
        status: productData.status ?? existingProduct.status,
        category: productData.category ?? existingProduct.category,
        restockThreshold: productData.restockThreshold ?? existingProduct.restockThreshold,
        restockPeriod: productData.restockPeriod ?? existingProduct.restockPeriod,
        updatedAt: productData.updatedAt ?? new Date().toISOString(),
        barCode: productData.barCode ?? existingProduct.barCode,
        storeNo: productData.storeNo ?? existingProduct.storeNo,
        state: productData.state ?? existingProduct.state
      };

      // Save the updated product back to the database
      return db.put(updatedProduct);
    })
    .then((response) => ({
      success: true,
      product: { _id: response.id, ...productData },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Add a new variant to a product
function addNewVariant(db, productId, variantData) {
  let existingProduct; // Declare the variable outside to make it accessible in all blocks

  return db
    .get(productId)
    .then((product) => {
      existingProduct = product; // Store the existing product

      // Create the new variant object
      const newVariant = {
        _id: variantData._id,
        productId: variantData.productId,
        name: variantData.name,
        conversionFactor: variantData.conversionFactor,
        unitPrice: variantData.unitPrice,
        storeNo: variantData.storeNo,
      };

      // Add the new variant to the existing product's variants array
      const updatedProduct = {
        ...existingProduct,
        variants: [...existingProduct.variants, newVariant],
        updatedAt: new Date().toISOString(), // Update the timestamp
      };

      // Save the updated product back to the database
      return db.put(updatedProduct);
    })
    .then((response) => ({
      success: true,
      product: { 
        _id: response.id, 
        ...existingProduct, 
        variants: [...existingProduct.variants, variantData],
        updatedAt: new Date().toISOString()
      },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update a variant in a product
function updateVariant(db, productId, variantId, variantData) {
  return db
    .get(productId)
    .then((existingProduct) => {
      // Find and update the specific variant
      const updatedVariants = existingProduct.variants.map((variant) => {
        if (variant._id === variantId) {
          return {
            ...variant,
            name: variantData.name ?? variant.name,
            conversionFactor: variantData.conversionFactor ?? variant.conversionFactor,
            unitPrice: variantData.unitPrice ?? variant.unitPrice,
            storeNo: variantData.storeNo ?? variant.storeNo,
          };
        }
        return variant;
      });

      // Create the updated product object
      const updatedProduct = {
        ...existingProduct,
        variants: updatedVariants,
        updatedAt: new Date().toISOString(), // Update the timestamp
      };

      // Save the updated product back to the database
      return db.put(updatedProduct);
    })
    .then((response) => ({
      success: true,
      product: {
        _id: response.id,
        updatedAt: new Date().toISOString(),
      },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Remove a variant from a product
function removeVariant(db, productId, variantId) {
  return db
    .get(productId)
    .then((existingProduct) => {
      // Filter out the variant to be removed
      const updatedVariants = existingProduct.variants.filter(
        (variant) => variant._id !== variantId
      );

      // Create the updated product object
      const updatedProduct = {
        ...existingProduct,
        variants: updatedVariants,
        updatedAt: new Date().toISOString(), // Update the timestamp
      };

      // Save the updated product back to the database
      return db.put(updatedProduct);
    })
    .then((response) => ({
      success: true,
      product: {
        _id: response.id,
        ...response,
        updatedAt: new Date().toISOString(),
      },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Restock multiple products
async function restockProducts(db, productsData) {
  console.log("Starting restockProducts with data:", productsData);
  try {
    // Validate the input data
    const isValid = productsData.every(product => {
      console.log("Validating product:", product);
      const valid = product.restockQuantity > 0 && 
        product.newBuyPrice > 0 && 
        product.supplierId && 
        product.amountOwed >= 0;
      console.log("Validation result:", valid);
      return valid;
    });
    if (!isValid) {
      console.log("Input validation failed");
      return { success: false, error: "Invalid input data" };
    }

    for (const product of productsData) {
      console.log("Processing product:", product);
      
      // Update product stock and buy price (send minimal fields for a safe partial update)
      const updatedProduct = {
        _id: product._id,
        stock: Number(product.stock) + Number(product.restockQuantity),
        buyPrice: product.newBuyPrice,
        updatedAt: new Date().toISOString()
      };
      console.log("Updated product data:", updatedProduct);
      
      const productResult = await updateProduct(db, updatedProduct);
      console.log("Product update result:", productResult);
      
      if (!productResult.success) {
        console.error("Failed to update product:", productResult.error);
        throw new Error(`Failed to update product: ${productResult.error}`);
      }

      // Get and update supplier
      console.log("Fetching supplier with ID:", product.supplierId);
      const supplierResult = await db.get(product.supplierId);
      console.log("Current supplier data:", supplierResult);
      
      const updatedSupplier = {
        ...supplierResult,
        balance: Number(supplierResult.balance) + Number(product.amountOwed)
      };
      console.log("Updated supplier data:", updatedSupplier);
      
      const supplierUpdateResult = await db.put(updatedSupplier);
      console.log("Supplier update result:", supplierUpdateResult);
    }

    console.log("Restock operation completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Error in restockProducts:", error);
    return { success: false, error: error.message };
  }
}

// Added a new function for product search
function searchVariants(db, searchTerm, storeNo) {
  console.log("Searching products with term:", searchTerm);
  return db.find({
      selector: {
        name: { $regex: new RegExp(searchTerm, 'i') }, // Create regex directly
        state: "Active",
        type: "product",
        storeNo: storeNo
      },
      limit: 100
    })
    .then((result) => {
      console.log("Search result:", result);
      // Flatten the products and their variants
      const flattenedProducts = result.docs.flatMap(product => {
        // If the product has no variants, return the product itself
        if (!product.variants || product.variants.length === 0) {
          return [{
            ...product,
            variantName: product.name,
            isBaseProduct: true
          }];
        }
        // Otherwise, return an array of product-variant combinations
        return product.variants.map(variant => ({
          ...product,
          ...variant,
          variantName: variant.name,
          productName: product.name,
          isBaseProduct: false
        }));
      });

      return { success: true, products: flattenedProducts };
    })
    .catch((error) => {
      console.error("Error searching products:", error);
      return { success: false, error: error.message };
    });
}

function searchProducts(db, searchTerm, storeNo) {
  console.log("Searching products with term:", searchTerm);
  return db.find({
      selector: {
        name: { $regex: new RegExp(searchTerm, 'i') },
        state: "Active",
        type: "product",
        storeNo: storeNo
      }
    })
    .then((result) => {
      console.log("Search result:", result);
      return { success: true, products: result.docs };
    })
    .catch((error) => {
      console.error("Error searching products:", error);
      return { success: false, error: error.message };
    });
}

// Get all saleItems related to a specific product
function getSaleItemsByProductId(db, productId, storeNo) {
  const endDate = new Date(); // Current date
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30); // 30 days ago

  return db
    .find({
      selector: {
        type: "sale",
        storeNo: storeNo,
        createdAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
      },
    })
    .then((result) => {
      // Map through sales and include sale ID with matching items
      const filteredSales = result.docs.reduce((acc, sale) => {
        const matchingItems = sale.items.filter(item => 
          item.productId === productId || item.variantId === productId
        );
        
        if (matchingItems.length > 0) {
          // Add sale ID to each matching item
          const itemsWithSaleId = matchingItems.map(item => ({
            ...item,
            saleId: sale._id,
            createdAt: sale.createdAt
          }));
      
          acc.push(...itemsWithSaleId);
        }
        return acc;
      }, []);
      
      return { 
        success: true, 
        saleItems: filteredSales
      };
    })
    .catch((error) => {
      console.error("Error fetching sale items for product:", error);
      return { success: false, error: error.message };
    });
}

// Delete a product
function archiveProduct(db, productId) {
  return db
    .get(productId)
    .then((product) => {
      // Update the state field to "Inactive"
      product.state = "Inactive";
      return db.put(product);
    })
    .then((response) => ({ success: true, product: { _id: response.id, status: "Inactive" } }))
    .catch((error) => ({ success: false, error: error.message }));
}

function getAllProducts(db, storeNo) {
  console.log("Starting getAllProducts function");
  return db
    .find({
      selector: { 
        type: "product",
        state: "Active",
        storeNo: storeNo
      },
      limit: 9999
    })
    .then((result) => {
      console.log("getAllProducts raw result:", JSON.stringify(result, null, 2));
      console.log("Number of docs found:", result.docs ? result.docs.length : 0);
      if (result.docs) {
        result.docs.forEach((doc, index) => {
          console.log(`Document ${index} _id:`, doc._id);
          console.log(`Document ${index} full content:`, JSON.stringify(doc, null, 2));
        });
      }
      return { success: true, products: result.docs };
    })
    .catch((error) => {
      console.error("Error in getAllProducts:", error);
      console.error("Error stack:", error.stack);
      return { success: false, error: error.message };
    });
}

// Get all products grouped in Variants
function getAllVariants(db, storeNo) {
  return db
    .find({
      selector: { 
        type: "product",
        state: "Active",
        storeNo: storeNo
      },
      limit: 1000
    })
    .then((result) => {
      console.log(result);
      // Flatten the products and their variants
      const flattenedProducts = result.docs.flatMap(product => {
        // If the product has no variants, return the product itself
        if (!product.variants || product.variants.length === 0) {
          return [{
            ...product,
            variantName: product.name,
            isBaseProduct: true
          }];
        }
        // Otherwise, return an array of product-variant combinations
        return product.variants.map(variant => ({
          ...product,
          ...variant,
          variantName: variant.name,
          productName: product.name,
          isBaseProduct: false
        }));
      });

      return { success: true, products: flattenedProducts };
    })
    .catch((error) => {
      console.error("Error fetching all products:", error);
      return { success: false, error: error.message };
    });
}

function getProductById(db, productId) {
  return db
    .get(productId)
    .then((product) => ({ success: true, product }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {
  addNewProduct,
  updateProduct,
  addNewVariant,
  updateVariant,
  removeVariant,
  archiveProduct,
  getAllProducts,
  getAllVariants,
  getProductById,
  searchVariants,
  getSaleItemsByProductId,
  restockProducts,
  searchProducts,
};
