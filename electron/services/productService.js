const { v4: uuidv4 } = require('uuid');
const { computeVariantUnitPrice, deriveMarginPercent } = require('../../lib/variantPricing');

function toStoredNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toStoredMarginPercent(value) {
  const parsedValue = toStoredNumber(value);
  return parsedValue !== null && parsedValue < 100 ? parsedValue : null;
}

function normalizeVariantForStorage(variantData, baseBuyPrice, fallbackVariant = {}) {
  const conversionFactor = toStoredNumber(variantData.conversionFactor ?? fallbackVariant.conversionFactor) ?? 0;
  const fallbackUnitPrice = toStoredNumber(fallbackVariant.unitPrice) ?? 0;
  const providedUnitPrice = toStoredNumber(variantData.unitPrice);
  const rawMarginPercent = variantData.marginPercent ?? fallbackVariant.marginPercent;
  const providedMarginPercent = rawMarginPercent === '' || rawMarginPercent === undefined || rawMarginPercent === null
    ? null
    : toStoredMarginPercent(rawMarginPercent);
  const derivedMarginPercent = deriveMarginPercent(
    baseBuyPrice,
    conversionFactor,
    providedUnitPrice ?? fallbackUnitPrice
  );
  const marginPercent = providedMarginPercent ?? derivedMarginPercent;
  const unitPrice = marginPercent !== null
    ? computeVariantUnitPrice(baseBuyPrice, conversionFactor, marginPercent)
    : (providedUnitPrice ?? fallbackUnitPrice);

  return {
    _id: variantData._id ?? fallbackVariant._id,
    productId: variantData.productId ?? fallbackVariant.productId,
    name: variantData.name ?? fallbackVariant.name,
    conversionFactor,
    unitPrice,
    ...(marginPercent !== null ? { marginPercent } : {}),
    storeNo: variantData.storeNo ?? fallbackVariant.storeNo,
  };
}

function addNewProduct(db, productData) {
  const baseBuyPrice = Number(productData.buyPrice) || 0;
  // Build initial batches array
  const initialBatches = [];
  if (productData.stock && Number(productData.stock) > 0) {
    initialBatches.push({
      batchId: uuidv4(),
      expiryDate: productData.expiryDate || null,
      quantity: Number(productData.stock),
      addedAt: new Date().toISOString(),
    });
  }

  const product = {
    _id: productData._id,
    type: "product",
    name: productData.name,
    uom: productData.uom,
    buyPrice: productData.buyPrice,
    stock: productData.stock,
    batches: productData.batches || initialBatches,
    variants: (productData.variants || []).map((variant) => normalizeVariantForStorage({
      ...variant,
      productId: productData._id,
    }, baseBuyPrice)),
    status: productData.status,
    category: productData.category || null,
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
        batches: productData.batches ?? existingProduct.batches ?? [],
        variants: (productData.variants
          ? productData.variants.map((variant) => ({
              _id: variant._id,
              productId: productData._id,
              name: variant.name,
              conversionFactor: variant.conversionFactor,
              unitPrice: variant.unitPrice,
              marginPercent: variant.marginPercent,
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
      const newVariant = normalizeVariantForStorage(
        {
          ...variantData,
          productId,
        },
        existingProduct.buyPrice
      );

      // Add the new variant to the existing product's variants array
      const updatedProduct = {
        ...existingProduct,
        variants: [...(existingProduct.variants || []), newVariant],
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
        variants: [
          ...(existingProduct.variants || []),
          normalizeVariantForStorage(
            {
              ...variantData,
              productId,
            },
            existingProduct.buyPrice
          ),
        ],
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
      const updatedVariants = (existingProduct.variants || []).map((variant) => {
        if (variant._id === variantId) {
          return normalizeVariantForStorage(
            {
              ...variant,
              ...variantData,
              _id: variantId,
              productId,
            },
            existingProduct.buyPrice,
            variant
          );
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
      const restockQuantity = Number(product.restockQuantity) || 0;
      const baseBuyPrice = Number(product.baseBuyPrice ?? product.newBuyPrice) || 0;
      const valid = restockQuantity > 0 && 
        baseBuyPrice > 0 && 
        product.supplierId && 
        Number(product.amountOwed) >= 0;
      console.log("Validation result:", valid);
      return valid;
    });
    if (!isValid) {
      console.log("Input validation failed");
      return { success: false, error: "Invalid input data" };
    }

    for (const product of productsData) {
      console.log("Processing product:", product);
      
      // Fetch the current product to get existing batches
      const existingProduct = await db.get(product._id);
      const existingBatches = existingProduct.batches || [];
      const updatedBuyPrice = Number(product.baseBuyPrice ?? product.newBuyPrice);

      // Create a new batch for this restock
      const newBatch = {
        batchId: uuidv4(),
        expiryDate: product.expiryDate || null,
        quantity: Number(product.restockQuantity),
        addedAt: new Date().toISOString(),
      };

      const updatedBatches = [...existingBatches, newBatch];
      const newStock = Number(existingProduct.stock || 0) + Number(product.restockQuantity);
      const updatedVariants = (existingProduct.variants || []).map((variant) => {
        const existingMargin = variant.marginPercent === '' || variant.marginPercent === undefined || variant.marginPercent === null
          ? null
          : toStoredMarginPercent(variant.marginPercent);
        const marginPercent = existingMargin ?? deriveMarginPercent(
          Number(existingProduct.buyPrice),
          Number(variant.conversionFactor),
          Number(variant.unitPrice)
        );

        if (marginPercent === null) {
          return variant;
        }

        return {
          ...variant,
          marginPercent,
          unitPrice: computeVariantUnitPrice(
            updatedBuyPrice,
            Number(variant.conversionFactor),
            marginPercent
          ),
        };
      });

      // Update product stock, buy price, and batches
      const updatedProduct = {
        _id: product._id,
        stock: newStock,
        buyPrice: updatedBuyPrice,
        batches: updatedBatches,
        variants: updatedVariants,
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
  return db.find({
      selector: {
        name: { $regex: new RegExp(searchTerm, 'i') },
        state: "Active",
        type: "product",
        storeNo: storeNo
      },
      limit: 100
    })
    .then((result) => {
      return { success: true, products: result.docs };
    })
    .catch((error) => {
      console.error("Error searching products:", error);
      return { success: false, error: error.message };
    });
}

// Get all saleItems related to a specific product
function getSaleItemsByProductId(db, productId, storeNo) {
  return db
    .find({
      selector: {
        type: "sale",
        storeNo: storeNo,
      },
      limit: 9999,
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

// Get products with batches expiring within N days
function getExpiringProducts(db, storeNo, daysThreshold = 30) {
  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(now.getDate() + daysThreshold);

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
      const expiringProducts = [];

      result.docs.forEach(product => {
        const batches = product.batches || [];
        const expiringBatches = batches.filter(batch => {
          if (!batch.expiryDate) return false;
          const expiry = new Date(batch.expiryDate);
          return expiry <= thresholdDate && batch.quantity > 0;
        });

        if (expiringBatches.length > 0) {
          expiringProducts.push({
            _id: product._id,
            name: product.name,
            category: product.category,
            stock: product.stock,
            batches: expiringBatches.map(b => ({
              ...b,
              isExpired: new Date(b.expiryDate) <= now,
            })),
          });
        }
      });

      return { success: true, products: expiringProducts };
    })
    .catch((error) => {
      console.error("Error fetching expiring products:", error);
      return { success: false, error: error.message };
    });
}

// Remove a specific batch from a product
function removeBatch(db, productId, batchId) {
  return db
    .get(productId)
    .then((product) => {
      const batches = product.batches || [];
      const batchToRemove = batches.find(b => b.batchId === batchId);
      const updatedBatches = batches.filter(b => b.batchId !== batchId);
      const removedQty = batchToRemove ? batchToRemove.quantity : 0;

      const updatedProduct = {
        ...product,
        batches: updatedBatches,
        stock: product.stock - removedQty,
        updatedAt: new Date().toISOString(),
      };

      return db.put(updatedProduct);
    })
    .then((response) => ({
      success: true,
      product: { _id: response.id },
    }))
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
  getExpiringProducts,
  removeBatch,
};
