 // Function to add a new product and its variants                    
 function addNewProduct(db, productData) {                            
  return db.post(productData)                                        
    .then(response => ({ success: true, product: { ...productData,   
_id: response.id, _rev: response.rev } }))                           
    .catch(error => {                                                
      console.error('Error adding new product:', error);             
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Update a product                                                  
function updateProduct(db, productData) {
  const product = {
    _id: `product_${productData._id}`,
    type: 'product',
    ...productData
  };
  return db.put(product)
    .then(response => ({ success: true, product: { _id: response.id, ...product } }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
// Added a new function for product search                           
function searchProducts(db, searchTerm) {                            
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
function getSaleItemsByProductId(db, productId, startDate, endDate) {
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
function deleteProduct(db, productId) {
  return db.get(`product_${productId}`)
    .then(doc => db.remove(doc))
    .then(() => ({ success: true }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function getAllProducts(db) {
  return db.find({
    selector: { type: 'product' }
  }).then(result => ({ success: true, products: result.docs }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function getProductById(db, productId) {
  return db.get(`product_${productId}`)
    .then(product => ({ success: true, product }))
    .catch(error => ({ success: false, error: error.message }));
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
   
