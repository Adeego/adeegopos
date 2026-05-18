import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import ViewProduct from '@/components/productComps/viewProduct';
import EditProduct from '@/components/productComps/editProduct';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { can } from '@/lib/rbac';

export default function ProductDetails() {
    const [product, setProduct] = useState(null);
    const [saleItems, setSaleItems] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const router = useRouter()
    const {id} = router.query
    const store = useWsinfoStore((state) => state.wsinfo);
    const staff = useStaffStore((state) => state.staff);
    const [storeNo, setStoreNo] = useState('');
    const canWriteProducts = can(staff, 'product:write');

    useEffect(() => {
      if (store && store.storeNo) {
        setStoreNo(store.storeNo);
      }
    }, [store]);

    useEffect(() => {
      if (id && storeNo) {
        fetchSelectedProduct();
        fetchProductSales();
      }
    }, [id, storeNo]);

    const fetchSelectedProduct = async () => {
        // if (!storeNo) return;
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
      // if (!storeNo) return;
      const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = new Date();
      try {
        const result = await window.electronAPI.realmOperation('getSaleItemsByProductId', id, storeNo);
        if (result.success) {
          setSaleItems(result.saleItems);
        } else {
          console.error('Failed to fetch sales items:', result.error);
        }
      } catch (error) {
        console.error('Error fetching sales items:', error);
      }
    }

    const handleSaleItems = async () => {
      if (!storeNo) return;
      try {
        const result = await window.electronAPI.realmOperation('getSaleItemsByProductId', id, storeNo);
        if (result.success) {
          setSaleItems(result.saleItems);
          console.log(result);
        }
      } catch (error) {
        console.error(error);
      }
    }

    const handleArchiveProduct = async () => {
      if (!canWriteProducts) return;
      if (!storeNo) return;
      const result = await window.electronAPI.realmOperation('archiveProduct', id, storeNo);
      if (result.success) {
        console.log("product was archived succesifully");
        router.push('/product');
      } else {
        console.error('Failed to archive product');
      }
    }

    const handleEditState = () => {
      if (!canWriteProducts) return;
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
          handleSaleItems={handleSaleItems}
          handleArchiveProduct={handleArchiveProduct}
          handleEditState={handleEditState}
          canWriteProducts={canWriteProducts}
        />}
    </div>
  )
}
