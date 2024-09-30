import React, {useState} from 'react';
import EditProduct from './editProduct';
import DeleteProduct from './deleteProduct';
import ProductSales from './productSales';
import { v4 as uuidv4 } from "uuid";
import { Dialog, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogContent, DialogFooter } from '../ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from 'next/link';
import { FilePenLine, Trash2, SquarePlus } from 'lucide-react';

export default function ViewProduct({ product, fetchSelectedProduct, saleItems, fetchProductSales, handleArchiveProduct, handleEditState }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newVariant, setNewVariant] = useState({
    name: '',
    conversionFactor: '',
    unitPrice: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewVariant(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

      try {
        const variantData = {
          ...newVariant,
          _id: `${product.storeNo}:${uuidv4()}`,
          productId: product._id,
          storeNo: product.storeNo,
        };

        const productId = product._id;

        const result = await window.electronAPI.realmOperation("addNewVariant", productId, variantData);
        if (result.success) {
          console.log('New variant:', newVariant);
          fetchSelectedProduct()
          setIsDialogOpen(false);
          setNewVariant({ name: '', conversionFactor: '', unitPrice: '' });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Error creating new variant:", error);
      }
  };

  const handleRemoveVariant = async (vId) => {
    try {
      const result = await window.electronAPI.realmOperation("removeVariant", product._id, vId);
      if (result.success) {
        console.log('Succesifully removed a variant');
        fetchSelectedProduct()
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error removing variant:", error);
    }
  }

  return (
    <div className="flex flex-col lg:flex-col gap-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <Card className="shadow-lg overflow-hidden rounded-md hover:shadow-xl transition-shadow duration-300 w-7/12">
          <CardHeader className="bg-gray-100">
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
            <CardFooter className="flex justify-between bg-gray-100 p-4">
              <Button onClick={() => {handleEditState()}} size="sm" className="hover:bg-blue-600 text-white">
                <p className='mr-2 text-sm'>Edit</p>
                <FilePenLine size={16} />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger>
                  <div variant="destructive" size="sm" className="flex flex-row p-2 rounded-md bg-red-500 hover:bg-red-600 text-white font-medium">
                    <p className='mr-2 text-sm'>Delete</p>
                    <Trash2 size={16} />
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {handleArchiveProduct()}} >Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>

          <Card className="shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 w-5/12">
            <CardHeader className="flex flex-row justify-between items-center bg-gray-100">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Product Variants</CardTitle>
                <CardDescription className="text-sm text-gray-600">Manage product variants</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="hover:bg-green-600 text-white">
                    <p className='mr-2 text-sm'>Add Variant</p>
                    <SquarePlus size={16} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Variant</DialogTitle>
                  </DialogHeader>
                  <DialogDescription >Fill all the fields</DialogDescription>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={newVariant.name}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter variant name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conversionFactor">Conversion Factor</Label>
                      <Input
                        id="conversionFactor"
                        name="conversionFactor"
                        type="number"
                        value={newVariant.conversionFactor}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter conversion factor"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unitPrice">Unit Price</Label>
                      <Input
                        id="unitPrice"
                        name="unitPrice"
                        type="number"
                        value={newVariant.unitPrice}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter unit price"
                      />
                    </div>
                    <Button type="submit" className="w-full">Add Variant</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-4">
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="text-base">
                      <TableHead>Name</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Conversion Factor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.variants.map((variant) => (
                      <TableRow key={variant._id} className="text-base" >
                        <TableCell>{variant.name}</TableCell>
                        <TableCell>{variant.unitPrice}</TableCell>
                        <TableCell>{variant.conversionFactor}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="secondery" className="rounded-md hover:bg-neutral-200" ><Trash2 className=" text-red-700" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the variant
                                  "{variant.name}" from the product.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveVariant(variant._id)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>    
          </Card>
      </div>
      <div className="w-full">
        <ProductSales saleItems={saleItems || []} onDateRangeChange={fetchProductSales} />
      </div>
    </div>
  );
}
