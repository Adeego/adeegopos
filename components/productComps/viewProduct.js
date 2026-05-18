import React, {useState} from 'react';
import ProductSales from './productSales';
import { v4 as uuidv4 } from "uuid";
import { Dialog, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogContent } from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
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
import { FilePenLine, Trash2, SquarePlus, Pencil, AlertTriangle, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const { computeVariantUnitPrice, deriveMarginPercent } = require('../../lib/variantPricing');

export default function ViewProduct({ product, fetchSelectedProduct, saleItems, handleArchiveProduct, handleEditState, canWriteProducts = false }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null)
  const [newVariant, setNewVariant] = useState({
    name: '',
    conversionFactor: '',
    marginPercent: ''
  })
  const [editVariantData, setEditVariantData] = useState({
    name: '',
    conversionFactor: '',
    marginPercent: ''
  })

  const getVariantMarginPercent = (variant) => {
    if (variant.marginPercent !== undefined && variant.marginPercent !== null && variant.marginPercent !== '') {
      const explicitMargin = Number(variant.marginPercent)
      return Number.isFinite(explicitMargin) ? explicitMargin : null
    }

    return deriveMarginPercent(
      Number(product.buyPrice),
      Number(variant.conversionFactor),
      Number(variant.unitPrice)
    )
  }

  const getVariantPreviewPrice = (conversionFactor, marginPercent) => computeVariantUnitPrice(
    Number(product.buyPrice) || 0,
    Number(conversionFactor),
    Number(marginPercent)
  )

  const validateVariantForm = (variantData) => {
    const conversionFactor = Number(variantData.conversionFactor)
    const marginPercent = Number(variantData.marginPercent)
    const hasMarginPercent = variantData.marginPercent !== undefined && variantData.marginPercent !== null && variantData.marginPercent !== ''

    if (!variantData.name || !Number.isFinite(conversionFactor) || conversionFactor <= 0 || !hasMarginPercent || !Number.isFinite(marginPercent) || marginPercent >= 100) {
      toast({
        title: "Variant details missing",
        description: "Enter a variant name, conversion factor, and a margin percent below 100.",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewVariant(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateVariantForm(newVariant)) {
      return;
    }

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
        setNewVariant({ name: '', conversionFactor: '', marginPercent: '' });
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

  const handleRemoveBatch = async (batchId) => {
    try {
      const result = await window.electronAPI.realmOperation("removeBatch", product._id, batchId);
      if (result.success) {
        fetchSelectedProduct();
        toast({ title: "Success", description: "Batch removed successfully" });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error removing batch:", error);
      toast({ title: "Error", description: "Failed to remove batch", variant: "destructive" });
    }
  }

  const getBatchStatus = (expiryDate) => {
    if (!expiryDate) return { label: 'No Expiry', color: 'bg-gray-100 text-gray-700', rowClass: '' };
    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 0) return { label: 'Expired', color: 'bg-red-100 text-red-700', rowClass: 'bg-red-50' };
    if (daysUntilExpiry <= 7) return { label: `${daysUntilExpiry}d left`, color: 'bg-orange-100 text-orange-700', rowClass: 'bg-orange-50' };
    if (daysUntilExpiry <= 30) return { label: `${daysUntilExpiry}d left`, color: 'bg-yellow-100 text-yellow-700', rowClass: 'bg-yellow-50' };
    return { label: `${daysUntilExpiry}d left`, color: 'bg-green-100 text-green-700', rowClass: '' };
  }

  const handleEditVariantClick = (variant) => {
    setEditingVariant(variant)
    setEditVariantData({
      name: variant.name,
      conversionFactor: variant.conversionFactor,
      marginPercent: getVariantMarginPercent(variant) ?? ''
    })
    setIsEditDialogOpen(true)
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditVariantData(prev => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!validateVariantForm(editVariantData)) {
      return;
    }

    try {
      const result = await window.electronAPI.realmOperation(
        "updateVariant", 
        product._id, 
        editingVariant._id,
        editVariantData
      );
      if (result.success) {
        console.log('Variant updated successfully');
        fetchSelectedProduct()
        setIsEditDialogOpen(false);
        setEditingVariant(null)
        setEditVariantData({ name: '', conversionFactor: '', marginPercent: '' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error updating variant:", error);
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
                { label: 'UoM', value: product.uom },
                { label: 'Buy Price', value: product.buyPrice },
                { label: 'Stock', value: `${product.stock} ${product.uom}` },
                { label: 'Status', value: product.status },
                { label: 'Restock Period', value: `${product.restockPeriod} days` },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
          {canWriteProducts && (
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
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Product Variants</CardTitle>
                <CardDescription>Manage margins and derived selling prices for each variant</CardDescription>
              </div>
              {canWriteProducts && <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                      <Label htmlFor="marginPercent">Margin %</Label>
                      <Input
                        id="marginPercent"
                        name="marginPercent"
                        type="number"
                        value={newVariant.marginPercent}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter margin percent"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price Preview</Label>
                      <div className="rounded-md border px-3 py-2 text-sm font-medium">
                        KES {getVariantPreviewPrice(newVariant.conversionFactor, newVariant.marginPercent).toFixed(2)}
                      </div>
                    </div>
                    <Button type="submit" className="w-full">Add Variant</Button>
                  </form>
                </DialogContent>
              </Dialog>}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Margin %</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Conversion</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants && product.variants.map((variant) => (
                  <TableRow key={variant._id}>
                    <TableCell className="font-medium">{variant.name}</TableCell>
                    <TableCell>
                      {getVariantMarginPercent(variant) !== null
                        ? `${getVariantMarginPercent(variant).toFixed(2)}%`
                        : '-'}
                    </TableCell>
                    <TableCell>{Number(variant.unitPrice || 0).toFixed(2)}</TableCell>
                    <TableCell>{variant.conversionFactor}</TableCell>
                    <TableCell>
                      {canWriteProducts && <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditVariantClick(variant)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
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
                      </div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Batches / Expiry Tracking */}
      {product.batches && product.batches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Stock Batches</CardTitle>
                <CardDescription>Track expiry dates for each batch of stock</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {product.batches.length} batch{product.batches.length !== 1 ? 'es' : ''}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...product.batches]
                  .sort((a, b) => {
                    if (!a.expiryDate && !b.expiryDate) return 0;
                    if (!a.expiryDate) return 1;
                    if (!b.expiryDate) return -1;
                    return new Date(a.expiryDate) - new Date(b.expiryDate);
                  })
                  .map((batch) => {
                    const status = getBatchStatus(batch.expiryDate);
                    return (
                      <TableRow key={batch.batchId} className={status.rowClass}>
                        <TableCell className="font-medium">
                          {batch.expiryDate
                            ? new Date(batch.expiryDate).toLocaleDateString()
                            : 'No expiry set'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                            {status.label === 'Expired' && <AlertTriangle className="mr-1 h-3 w-3" />}
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell>{batch.quantity} {product.uom}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {batch.addedAt
                            ? new Date(batch.addedAt).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {canWriteProducts && <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Batch</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove this batch ({batch.quantity} {product.uom})? This will also reduce the total stock.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveBatch(batch.batchId)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ProductSales saleItems={saleItems || []} />

      {/* Edit Variant Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
            <DialogDescription>Update the variant details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                name="name"
                value={editVariantData.name}
                onChange={handleEditInputChange}
                required
                placeholder="Enter variant name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-conversionFactor">Conversion Factor</Label>
              <Input
                id="edit-conversionFactor"
                name="conversionFactor"
                type="number"
                value={editVariantData.conversionFactor}
                onChange={handleEditInputChange}
                required
                placeholder="Enter conversion factor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-marginPercent">Margin %</Label>
              <Input
                id="edit-marginPercent"
                name="marginPercent"
                type="number"
                value={editVariantData.marginPercent}
                onChange={handleEditInputChange}
                required
                placeholder="Enter margin percent"
              />
            </div>
            <div className="space-y-2">
              <Label>Price Preview</Label>
              <div className="rounded-md border px-3 py-2 text-sm font-medium">
                KES {getVariantPreviewPrice(editVariantData.conversionFactor, editVariantData.marginPercent).toFixed(2)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">Update Variant</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
