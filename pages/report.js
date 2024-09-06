import React from 'react'
import SalesReport from '@/components/reportComps/salesReport'
import ProductReport from '@/components/reportComps/productReport'
import TopCustomers from '@/components/reportComps/topCustomers'

export default function Report() {
  return (
    <div>
      <SalesReport />
      <ProductReport />
      <TopCustomers />
    </div>
  )
}
