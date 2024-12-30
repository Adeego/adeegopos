"use client"

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { v4 as uuidv4 } from "uuid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import useWsinfoStore from '@/stores/wsinfo'
import { useToast } from '@/components/ui/use-toast'

const ProductTable = ({ products }) => {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [editedProduct, setEditedProduct] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { toast } = useToast();

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentProducts = products.slice(indexOfFirstItem, indexOfLastItem)

  // Calculate total pages
  const totalPages = Math.ceil(products.length / itemsPerPage)

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  const importProduct = async (data) => {
    try {
      const result = await window.electronAPI.realmOperation('addNewProduct', data)
      if (result.success) {
        toast({
          title: "Imported Successfully",
          description: "The product has been successfully imported"
        });
        setOpenDialog(false);
        console.log(result);
      }
    } catch (error) {
      console.log(error)
      toast({
        title: "Error",
        description: `${error}`,
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Product List</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Product</TableHead>
                <TableHead className="w-[20%]">Buy Price</TableHead>
                <TableHead className="w-[20%]">UOM</TableHead>
                <TableHead className="w-[20%]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProducts.map((product, index) => (
                <TableRow 
                  key={product._id}
                  className={index % 2 === 0 ? "bg-muted/50" : ""}
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.buyPrice.toFixed(2)}</TableCell>
                  <TableCell>{product.uom}</TableCell>
                  <TableCell>
                    <Dialog open={openDialog} onOpenChange={setOpenDialog} >
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(product);
                            setEditedProduct({...product});
                          }}
                        >
                          Import
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[625px]">
                        <DialogHeader>
                          <DialogTitle>Product Details</DialogTitle>
                          <DialogDescription>
                            Edit and confirm the details before adding the product.
                          </DialogDescription>
                        </DialogHeader>
                        {editedProduct && (
                          <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="grid grid-rows-4 gap-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                  Name
                                </Label>
                                <Input 
                                  id="name" 
                                  value={editedProduct.name} 
                                  onChange={(e) => setEditedProduct({...editedProduct, name: e.target.value})}
                                  className="col-span-3" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="price" className="text-right">
                                  Buy Price
                                </Label>
                                <Input 
                                  id="price" 
                                  type="number"
                                  value={editedProduct.buyPrice} 
                                  onChange={(e) => setEditedProduct({...editedProduct, buyPrice: parseFloat(e.target.value)})}
                                  className="col-span-3" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="uom" className="text-right">
                                  UOM
                                </Label>
                                <Input 
                                  id="uom" 
                                  value={editedProduct.uom} 
                                  onChange={(e) => setEditedProduct({...editedProduct, uom: e.target.value})}
                                  className="col-span-3" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="stock" className="text-right">
                                  Stock
                                </Label>
                                <Input 
                                  id="stock" 
                                  type="number"
                                  value={editedProduct.stock} 
                                  onChange={(e) => setEditedProduct({...editedProduct, stock: parseInt(e.target.value)})}
                                  className="col-span-3" 
                                />
                              </div>
                            </div>
                            <div className="grid grid-rows-4 gap-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="status" className="text-right">
                                  Status
                                </Label>
                                <Input 
                                  id="status" 
                                  value={editedProduct.status} 
                                  onChange={(e) => setEditedProduct({...editedProduct, status: e.target.value})}
                                  className="col-span-3" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="restockThreshold" className="text-right">
                                  Restock Threshold
                                </Label>
                                <Input 
                                  id="restockThreshold" 
                                  type="number"
                                  value={editedProduct.restockThreshold} 
                                  onChange={(e) => setEditedProduct({...editedProduct, restockThreshold: parseInt(e.target.value)})}
                                  className="col-span-3" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="restockPeriod" className="text-right">
                                  Restock Period
                                </Label>
                                <Input 
                                  id="restockPeriod" 
                                  type="number"
                                  value={editedProduct.restockPeriod} 
                                  onChange={(e) => setEditedProduct({...editedProduct, restockPeriod: parseInt(e.target.value)})}
                                  className="col-span-3" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="restock" className="text-right">
                                  Restock
                                </Label>
                                <Input 
                                  id="restock" 
                                  type="checkbox"
                                  checked={editedProduct.restock} 
                                  onChange={(e) => setEditedProduct({...editedProduct, restock: e.target.checked})}
                                  className="col-span-3" 
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render the editedProduct.variant array here */}
                        {editedProduct && (
                          <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-lg font-semibold">Variants</h3>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const newVariant = {
                                    _id: uuidv4(),
                                    name: 'New Variant',
                                    unitPrice: 0,
                                    productId: editedProduct._id,
                                    storeNo: editedProduct.storeNo
                                  };
                                  setEditedProduct({
                                    ...editedProduct, 
                                    variants: [...(editedProduct.variants || []), newVariant]
                                  });
                                }}
                              >
                                Add Variant
                              </Button>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Unit Price</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(editedProduct.variants || []).map((variant, index) => (
                                  <TableRow key={variant._id}>
                                    <TableCell>
                                      <Input 
                                        value={variant.name} 
                                        onChange={(e) => {
                                          const updatedVariants = [...(editedProduct.variants || [])];
                                          updatedVariants[index] = {...variant, name: e.target.value};
                                          setEditedProduct({...editedProduct, variants: updatedVariants});
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input 
                                        type="number"
                                        value={variant.unitPrice} 
                                        onChange={(e) => {
                                          const updatedVariants = [...(editedProduct.variants || [])];
                                          updatedVariants[index] = {...variant, unitPrice: parseFloat(e.target.value)};
                                          setEditedProduct({...editedProduct, variants: updatedVariants});
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button 
                                        variant="destructive" 
                                        size="sm"
                                        onClick={() => {
                                          const updatedVariants = (editedProduct.variants || []).filter((_, i) => i !== index);
                                          setEditedProduct({...editedProduct, variants: updatedVariants});
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <DialogFooter>
                          <Button onClick={() => importProduct(editedProduct)} >Confirm Import</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination Controls */}
          <div className="flex justify-center items-center mt-4 space-x-2">
            <Button 
              onClick={() => paginate(currentPage - 1)} 
              disabled={currentPage === 1}
              variant="outline"
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button 
              onClick={() => paginate(currentPage + 1)} 
              disabled={currentPage === totalPages}
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Store() {
  const [products, setProducts] = useState([])
  const [restockPeriod, setRestockPeriod] = useState("1D")
  const [storeNo, setStoreNo] = useState(null)
  const store = useWsinfoStore((state) => state.wsinfo);

  useEffect(() => {
    if(store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store.storeNo])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://64.227.129.110:8000/products?skip=0&limit=500')
        const productsWithDefaults = response.data.products.map(product => {
          const _id = `${storeNo}:${uuidv4()}`;
          return {
            ...product,
            _id: _id,
            stock: 20,
            status: "In Stock",
            variants: product.variants ? product.variants.map((variant) => ({
              ...variant,
              _id: `${uuidv4()}`,
              productId: _id,
              storeNo: storeNo
            })) : [],
            restockThreshold: 15,
            restockPeriod: parseInt(restockPeriod.replace('D', '')),
            restock: false,
            storeNo: storeNo
          }
        })
        console.log(productsWithDefaults)
        setProducts(productsWithDefaults)
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }

    if (storeNo) {
      fetchProducts();
    }
  }, [restockPeriod, storeNo])

  const handleTabChange = (value) => {
    setRestockPeriod(value)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <Card className="w-full ">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800">Restock Period</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="1D" className="w-full" onValueChange={handleTabChange}>
              <TabsList className="grid grid-cols-4 w-full bg-gray-100 p-1 rounded-lg gap-1">
                {["1D", "7D", "15D", "30D"].map((period) => (
                  <TabsTrigger
                    key={period}
                    value={period}
                    className="rounded-md py-2 text-sm font-medium transition-all 
                      data-[state=active]:bg-primary 
                      data-[state=active]:text-primary-foreground 
                      data-[state=active]:shadow-sm
                      hover:bg-muted"
                  >
                    {period}
                  </TabsTrigger>
                ))}
              </TabsList>
              {["1D", "7D", "15D", "30D"].map((period) => (
                <TabsContent key={period} value={period} className="mt-4">
                  <ProductTable products={products} />
                </TabsContent>
              ))}
            </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
