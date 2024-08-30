import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import ViewProduct from '@/components/productComps/viewProduct';

export default function ProductDetails() {
    const [product, setProduct] = useState(null);
    const [saleItems, setSaleItems] = useState([]);
    const router = useRouter()
    const {id} = router.query

    useEffect(() => {
        fetchSelectedProduct();
        fetchProductSales();
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

    const fetchProductSales = async () => {
      try {
        const result = await window.electronAPI.realmOperation('getSaleItemsByProductId', id);
        if (result.success) {
          setSaleItems(result.saleItems);
        } else {
          console.error('Failed to fetch sales items:', result.error);
        }
      } catch (error) {
        console.error('Error fetching sales items:', error);
      }
    }

  return (
    <div className=''>
        {product && <ViewProduct product={product} fetchSelectedProduct={fetchSelectedProduct} saleItems={saleItems} />}
    </div>
  )
}