import React from 'react'
import SalesPMPieChart from './salesPMPieChart'
import TotalSalesChart from './totalSalesChart'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Separator } from '@/components/ui/separator'

export default function SalesReport() {
  return (
    <Card className="h-[580px] w-[600px]">
      <CardHeader className="h-[50px] bg-gray-100">
        <CardTitle>Sales</CardTitle>
      </CardHeader>
      <CardContent className="flex p-0" >
        <TotalSalesChart />
        <SalesPMPieChart />
      </CardContent>
      <CardFooter className="px-2" >
        <Card className="flex justify-around text-3xl w-[100%] h-[70px] p-2" >
          <div>4789338</div>
          <Separator orientation="vertical" />
          <div>4789338</div>
          <Separator orientation="vertical" />
          <div>4789338</div>
        </Card>
      </CardFooter>
    </Card>
  )
}
