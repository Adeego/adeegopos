// Query all products for a specific supplier                        
function getSupplierProducts(db) {                                   
  return db.allDocs({ include_docs: true })                          
    .then(result => ({ success: true, suppliers: result.rows.map(row => row.doc) }))                                                      
    .catch(error => {                                                
      console.error('Error fetching suppliers:', error);             
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
module.exports = {                                                   
  getSupplierProducts                                                
};                                                                   
  