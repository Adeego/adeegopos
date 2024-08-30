import React from 'react';
import EditProduct from './editProduct';
import DeleteProduct from './deleteProduct';
import ProductSales from './productSales';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from 'next/link';
import { FilePenLine, Trash2, SquarePlus } from 'lucide-react';

export default function ViewProduct({ product, fetchSelectedProduct, saleItems }) {

  return (
    <div className="flex flex-col lg:flex-row gap-8">
    <div className="w-full lg:w-1/3">
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-2xl font-bold text-gray-800">{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
            <div className="space-y-2 text-gray-700 ">
              <div className="w-full flex items-center justify-between">
                <div className="text-base font-medium text-neutral-700">BASE UNIT</div>
                <div className="text-base font-medium text-gray-900">{product.baseUnit}</div>
              </div>
              <Separator />
              <div className="w-full flex items-center justify-between">
                <div className="text-base font-medium text-neutral-700">UNIT PRICE</div>
                <div className="text-base font-medium text-gray-900">{product.buyPrice}</div>
              </div>
              <Separator />
              <div className="w-full flex items-center justify-between">
                <div className="text-base font-medium text-neutral-700">STOCK</div>
                <div className="text-base font-medium text-gray-900">{product.stock} {product.baseUnit}</div>
              </div>
              <Separator />
              <div className="w-full flex items-center justify-between">
                <div className="text-base font-medium text-neutral-700">STATUS</div>
                <div className="text-base font-medium text-gray-900">{product.status}</div>
              </div>
              <Separator />
              <div className="w-full flex items-center justify-between">
                <div className="text-base font-medium text-neutral-700">CATEGORY</div>
                <div className="text-base font-medium text-gray-900">{product.category}</div>
              </div>
              <Separator />
              <div className="w-full flex items-center justify-between">
                <div className="text-base font-medium text-neutral-700">RESTOCK PERIOD</div>
                <div className="text-base font-medium text-gray-900">{product.restockPeriod} DAYS</div>
              </div>
              <Separator />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between bg-gray-50 p-4">
            <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white">
              <p className='mr-2 text-sm'>Edit</p>
              <FilePenLine size={16} />
            </Button>
            <Button variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600 text-white">
              <p className='mr-2 text-sm'>Delete</p>
              <Trash2 size={16} />
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 mt-8">
          <CardHeader className="flex flex-row justify-between items-center bg-gray-50">
            <div>
              <CardTitle className="text-xl font-bold text-gray-800">Product Variants</CardTitle>
              <CardDescription className="text-sm text-gray-600">Manage product variants</CardDescription>
            </div>
            <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white">
              <p className='mr-2 text-sm'>Add Variant</p>
              <SquarePlus size={16} />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <div>
              <Table>
                <TableHeader>
                  <TableRow className="text-base">
                    <TableHead>Name</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Conversion Factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.variants.map((variant) => (
                    <TableRow key={variant._id} className="text-base" >
                      <TableCell>{variant.name}</TableCell>
                      <TableCell>{variant.unitPrice}</TableCell>
                      <TableCell>{variant.conversionFactor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
        </Card>
      </div>
      <div className="w-full lg:w-2/3">
        <ProductSales saleItems={saleItems || []} />
      </div>
    </div>
  );
}

{/* <Sheet>
      <SheetTrigger asChild>
        <h1>
          <Link href={`/product/${product._id}`}>View</Link>
        </h1>
      </SheetTrigger>

      { !isEditing && 
        <SheetContent className="xl:max-w-[400px] w-[600px] sm:w-[540px]">
        <SheetHeader className="mt-4">
          <div className="flex justify-between items-center">
            <SheetTitle className="text-2xl font-semibold text-gray-900">{product.name}</SheetTitle>
          </div>
        </SheetHeader>
        <SheetDescription className="my-2">
          <div className="w-full flex items-center justify-between">
            <div className="text-xl font-bold text-neutral-700">Price</div>
            <div className="text-xl font-bold text-gray-900">KES {product.unitPrice}</div>
          </div>
        </SheetDescription>
        <div className="space-y-4 text-gray-700 text-sm mb-6" >
          <div className="w-full flex items-center justify-between">
            <div className="text-xl font-bold text-neutral-700">Quantity</div>
            <div className="text-xl font-bold text-gray-900">{product.quantity}</div>
          </div>
          <div className="w-full flex items-center justify-between">
            <div className="text-xl font-bold text-neutral-700">Unit</div>
            <div className="text-xl font-bold text-gray-900">{product.unit}</div>
          </div>
          <div className="w-full flex items-center justify-between">
            <div className="text-xl font-bold text-neutral-700">Unit Price</div>
            <div className="text-xl font-bold text-gray-900">{product.unitPrice}</div>
          </div>
          <div className="w-full flex items-center justify-between">
            <div className="text-xl font-bold text-neutral-700">Stock</div>
            <div className="text-xl font-bold text-gray-900">{product.stock}</div>
          </div>
          <div className="w-full flex items-center justify-between">
            <div className="text-xl font-bold text-neutral-700">Status</div>
            <div className="text-xl font-bold text-gray-900">{product.status}</div>
          </div>
          <Separator />
        </div>

        <SheetFooter>
          <DeleteProduct productId={product._id} productName={product.name} onDeleteSuccess={fetchProducts} />
          <button onClick={handleEditState} >
            Edit
          </button>
        </SheetFooter>
      </SheetContent>
      }

      { isEditing && 
        <SheetContent className="xl:max-w-[400px] w-[600px] sm:w-[540px]">
          <SheetHeader className="mt-4">
            <SheetTitle className="text-2xl font-semibold text-gray-900">Edit Products</SheetTitle>
          </SheetHeader>
          <SheetDescription className="my-2">
            <h3>All changes will directly reflect in db</h3>
          </SheetDescription>
            <EditProduct product={product} onEditSuccess={fetchProducts} isEditing={isEditing} handleEditState={handleEditState} />
          <SheetFooter>
            <button variant="outline" >
              Delete
            </button>
            <button onClick={handleEditState} >
              Edit
            </button>
          </SheetFooter>
        </SheetContent>
      }
      
    </Sheet> */}

//className="flex justify-between"
//className="space-y-4 text-gray-700 text-sm mb-6"