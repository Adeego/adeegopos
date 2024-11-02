import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

export default function Restock() {
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      searchProducts()
    } else {
      setProducts([])
    }
  }, [searchTerm])

  const loadSuppliers = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllSuppliers');
      if (result.success) {
        setSuppliers(result.suppliers);
      } else {
        console.error('Failed to fetch suppliers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        variant: "destructive",
        title: "Error loading suppliers",
        description: error.message
      })
    }
  }

  const searchProducts = async () => {
    try {
      const result = await window.electronAPI.searchProducts(searchTerm);
      if (result.success) {
        setProducts(result.products)
      } else {
        console.error('Search failed:', result.error);
      }
    } catch (error) {
      console.log(error)
      toast({
        variant: "destructive",
        title: "Error searching products",
        description: error.message
      })
    }
  }

  const addProductToRestock = (product) => {
    if (!selectedProducts.find(p => p._id === product._id)) {
      setSelectedProducts([...selectedProducts, {
        ...product,
        restockQuantity: 0,
        newBuyPrice: product.buyPrice,
        supplierId: '',
        amountOwed: 0
      }])
    }
  }

  const updateSelectedProduct = (productId, field, value) => {
    setSelectedProducts(selectedProducts.map(product => {
      if (product._id === productId) {
        return { ...product, [field]: value }
      }
      return product
    }))
  }

  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p._id !== productId))
  }

  const handleRestock = async () => {
    try {
      // Validate all fields are filled
      const isValid = selectedProducts.every(product => 
        product.restockQuantity > 0 && 
        product.newBuyPrice > 0 && 
        product.supplierId && 
        product.amountOwed >= 0
      )

      if (!isValid) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill all required fields for each product"
        })
        return
      }

      const result = await window.electronAPI.realmOperation('restockProducts', selectedProducts);
      console.log(result);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Products restocked successfully"
        })
        setSelectedProducts([])
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error restocking products",
        description: error.message
      })
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Restock Products</h1>
      
      {/* Search Products */}
      <Card className="p-4 mb-4">
        <Label htmlFor="search">Search Products</Label>
        <Input
          id="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by product name..."
          className="mb-4"
        />

        {products.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product._id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>{product.buyPrice}</TableCell>
                  <TableCell>
                    <Button 
                      onClick={() => addProductToRestock(product)}
                      disabled={selectedProducts.some(p => p._id === product._id)}
                    >
                      Add to Restock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Selected Products */}
      {selectedProducts.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Selected Products</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Amount Owed</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedProducts.map((product) => (
                <TableRow key={product._id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={product.restockQuantity}
                      onChange={(e) => updateSelectedProduct(product._id, 'restockQuantity', e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={product.newBuyPrice}
                      onChange={(e) => updateSelectedProduct(product._id, 'newBuyPrice', e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={product.supplierId}
                      onValueChange={(value) => updateSelectedProduct(product._id, 'supplierId', value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier._id} value={supplier._id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={product.amountOwed}
                      onChange={(e) => updateSelectedProduct(product._id, 'amountOwed', e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="destructive"
                      onClick={() => removeProduct(product._id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4">
            <Button onClick={handleRestock}>
              Restock Products
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
