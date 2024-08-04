import React from 'react'
import SelectedProductsTable from './SelectedProductsTable';
import ProductSearch from './ProductSearch';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '../ui/card'

function SaleCard() {
  return (
    <div className="h-screen">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-left">New Sale</CardTitle>
            <CardDescription className="text-left">Fill all the required fields</CardDescription>
          </CardHeader>
          <CardContent className="h-1/2">
            <div className="flex h-full">
              <div className="w-2/3 pr-4">
                <SelectedProductsTable />
              </div>
              <div className="w-1/3">
                <ProductSearch />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>
    </div>
  )
}

export default SaleCard