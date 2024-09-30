'use client'

import React, { useState } from 'react'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function EditProduct({ product, handleEditState, fetchSelectedProduct }) {
  const [formData, setFormData] = useState(product)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value) => {
    setFormData((prev) => ({ ...prev, status: value }))
  }

  const handleEditing = async () => {
    try {
      const editFields = {
        ...formData,
        buyPrice: parseFloat(formData.buyPrice.toString()),
      }
      console.log(editFields)
      const result = await window.electronAPI.realmOperation('updateProduct', editFields)
      if (result.success) {
        toast({
          title: "Success",
          description: "Product updated successfully!",
        })
        fetchSelectedProduct()
        handleEditState()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating product:', error)
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Product</CardTitle>
      </CardHeader>
      <div >
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUnit">Base Unit</Label>
              <Input id="baseUnit" name="baseUnit" value={formData.baseUnit} onChange={handleInputChange} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyPrice">Buy Price</Label>
              <Input id="buyPrice" name="buyPrice" type="number" value={formData.buyPrice} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barCode">Bar Code</Label>
              <Input id="barCode" name="barCode" value={formData.barCode} onChange={handleInputChange} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={handleSelectChange} defaultValue={formData.status}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Stock">In Stock</SelectItem>
                  <SelectItem value="Out Stock">Out of Stock</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" value={formData.category} onChange={handleInputChange} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => {handleEditState()}}>Cancel</Button>
          <Button onClick={() => {handleEditing()}} >Update</Button>
        </CardFooter>
      </div>
    </Card>
  )
}