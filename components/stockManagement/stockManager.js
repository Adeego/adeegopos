export const manageRestock = async (storeNo) => {
    try {
        const result = await window.electronAPI.restock('restockCheckup', storeNo);
        if (result.success) {
            const productIds = result.products.map(product => product._id);
            console.log(productIds)
            try {
                const restockData = await window.electronAPI.restock('calculateRestock', productIds);
                if (restockData.success) {
                    console.log(restockData);
                } else if (!restockData.success) {
                    console.error(restockData.error)
                }
            } catch (error) {
                console.error(error);
            }
            return result.products
        }
    } catch (error) {
      console.error(error)  
    }
}
