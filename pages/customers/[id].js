import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ViewCustomer from '@/components/customerComps/viewCustomer'

export default function CustomerDetail() {
  const [customer, setCustomer] = useState(null);
  const router = useRouter()
  const {id} = router.query

  useEffect(() => {
    fetchSelectedCustomer();
  }, [id]);

  const fetchSelectedCustomer = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getCustomerById', id);
      if (result.success) {
        setCustomer(result.customer);
      } else {
        console.error('Failed to fetch customer:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Customer Details</h1>
      {customer ? (
        <ViewCustomer customer={customer} />
      ) : (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customer data...</p>
        </div>
      )}
    </div>
  )
}
