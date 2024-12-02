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
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{product.name}</CardTitle>
            <CardDescription>Product Details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Base Unit', value: product.baseUnit },
                { label: 'Unit Price', value: product.buyPrice },
                { label: 'Stock', value: `${product.stock} ${product.baseUnit}` },
                { label: 'Status', value: product.status },
                { label: 'Category', value: product.category },
                { label: 'Restock Period', value: `${product.restockPeriod} days` },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={handleEditState} size="sm" className="text-white">
              <FilePenLine className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the product
                    and remove all associated data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchiveProduct}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Product Variants</CardTitle>
                <CardDescription>Manage product variants</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="text-white">
                    <SquarePlus className="mr-2 h-4 w-4" />
                    Add Variant
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Variant</DialogTitle>
                    <DialogDescription>Fill all the fields to add a new variant.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Conversion</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant) => (
                  <TableRow key={variant._id}>
                    <TableCell className="font-medium">{variant.name}</TableCell>
                    <TableCell>{variant.unitPrice}</TableCell>
                    <TableCell>{variant.conversionFactor}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Variant</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove the variant {variant.name}? This action cannot be undone.
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
          </CardContent>
        </Card>
      </div>
      
      <ProductSales saleItems={product.saleItems || []} />
    </div>
  );
}
