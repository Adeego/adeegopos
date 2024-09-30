import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import ViewProduct from '@/components/productComps/viewProduct';
import EditProduct from '@/components/productComps/editProduct';

export default function ProductDetails() {
    const [product, setProduct] = useState(null);
    const [saleItems, setSaleItems] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const router = useRouter()
    const {id} = router.query

    useEffect(() => {
      if (id) {
        fetchSelectedProduct();
        fetchProductSales();
      }
    }, [id]);

    const fetchSelectedProduct = async () => {
        try {
          const result = await window.electronAPI.realmOperation('getProductById', id);
          if (result.success) {
            setProduct(result.product);
          } else {
            console.error('Failed to fetch product:', result.error);
          }
        } catch (error) {
          console.error('Error fetching product:', error);
        }
    }

    const fetchProductSales = async (startDate = new Date(new Date().setDate(new Date().getDate() - 30)), endDate = new Date()) => {
      try {
        const result = await window.electronAPI.realmOperation('getSaleItemsByProductId', id, startDate, endDate);
        if (result.success) {
          setSaleItems(result.saleItems);
        } else {
          console.error('Failed to fetch sales items:', result.error);
        }
      } catch (error) {
        console.error('Error fetching sales items:', error);
      }
    }

    const handleArchiveProduct = async () => {
      console.log(id)
      const result = await window.electronAPI.realmOperation('archiveProduct', id);
      if (result.success) {
        console.log("product was archived succesifully");
      } else {
        console.error('Failed to archive product');
      }
    }

    const handleEditState = () => {
      if (isEditing){
        setIsEditing(false)
      } else {
        setIsEditing(true)
      }
    }

  return isEditing? (
    <div>
      {
        product && <EditProduct 
          product={product}
          handleEditState={handleEditState}
          fetchSelectedProduct={fetchSelectedProduct}
        />
      } 
    </div>
  ) : (
    <div className=''>
        {product && <ViewProduct 
          product={product} 
          fetchSelectedProduct={fetchSelectedProduct} 
          saleItems={saleItems} 
          fetchProductSales={fetchProductSales}
          handleArchiveProduct={handleArchiveProduct}
          handleEditState={handleEditState}
        />}
    </div>
  )
}
