import React, { useEffect, useMemo, useState } from 'react'
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
import useWsinfoStore from '@/stores/wsinfo'
import { v4 as uuidv4 } from 'uuid'

const getBaseUnitName = (product) => product.uom || product.baseUnit || 'PCS'

const getRestockUnits = (product) => {
  const baseUnit = {
    key: 'base',
    name: getBaseUnitName(product),
    conversionFactor: 1
  }

  const variants = (product.variants || [])
    .map((variant) => ({
      key: variant._id || `${variant.name}-${variant.conversionFactor}`,
      name: variant.name || getBaseUnitName(product),
      conversionFactor: Number(variant.conversionFactor) || 1
    }))
    .filter((variant) => variant.conversionFactor > 0)
    .sort((a, b) => b.conversionFactor - a.conversionFactor)

  const seen = new Set()

  return [...variants, baseUnit].filter((unit) => {
    const signature = `${unit.name}-${unit.conversionFactor}`.toLowerCase()
    if (seen.has(signature)) {
      return false
    }
    seen.add(signature)
    return true
  })
}

const getDefaultRestockUnit = (product) => getRestockUnits(product)[0] || {
  key: 'base',
  name: getBaseUnitName(product),
  conversionFactor: 1
}

const normalizeSearchValue = (value) => value.trim().toLowerCase()

const getSearchRank = (product, normalizedSearchTerm) => {
  const name = String(product.name || '').toLowerCase()
  const barCode = String(product.barCode || '').toLowerCase()

  if (name === normalizedSearchTerm || barCode === normalizedSearchTerm) {
    return 0
  }

  if (name.startsWith(normalizedSearchTerm) || barCode.startsWith(normalizedSearchTerm)) {
    return 1
  }

  return 2
}

const matchesProductSearch = (product, normalizedSearchTerm) => {
  if (!normalizedSearchTerm) {
    return false
  }

  const searchableValues = [
    product.name,
    product.barCode,
    product.category,
    product.uom,
    product.baseUnit
  ]

  return searchableValues.some((value) =>
    String(value || '').toLowerCase().includes(normalizedSearchTerm)
  )
}

const MAX_SEARCH_RESULTS = 50

const recalculateSelectedProduct = (product) => {
  const purchaseQuantity = Number(product.purchaseQuantity) || 0
  const restockConversionFactor = Number(product.restockConversionFactor) || 1
  const unitBuyPrice = Number(product.newBuyPrice) || 0
  const baseBuyPrice = restockConversionFactor > 0 ? unitBuyPrice / restockConversionFactor : unitBuyPrice

  return {
    ...product,
    purchaseQuantity,
    restockConversionFactor,
    restockQuantity: purchaseQuantity * restockConversionFactor,
    baseBuyPrice,
    amountOwed: purchaseQuantity * unitBuyPrice
  }
}

export default function Restock() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [allProducts, setAllProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [invoiceSupplierId, setInvoiceSupplierId] = useState('')
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return

    const loadProducts = async () => {
      try {
        const result = await window.electronAPI.realmOperation('getAllProducts', storeNo)
        if (result.success) {
          setAllProducts(result.products)
        } else {
          console.error('Failed to fetch products:', result.error)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        toast({
          variant: "destructive",
          title: "Error loading products",
          description: error.message
        })
      }
    }

    loadProducts()
  }, [storeNo])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 150)

    return () => window.clearTimeout(timeoutId)
  }, [searchTerm])

  useEffect(() => {
    if (!storeNo) return

    const loadSuppliers = async () => {
      try {
        const result = await window.electronAPI.realmOperation('getAllSuppliers', storeNo)
        if (result.success) {
          setSuppliers(result.suppliers)
        } else {
          console.error('Failed to fetch suppliers:', result.error)
        }
      } catch (error) {
        console.error('Error fetching suppliers:', error)
        toast({
          variant: "destructive",
          title: "Error loading suppliers",
          description: error.message
        })
      }
    }

    loadSuppliers()
  }, [storeNo])

  const products = useMemo(() => {
    const normalizedSearchTerm = normalizeSearchValue(debouncedSearchTerm)

    if (!normalizedSearchTerm) {
      return []
    }

    const selectedProductIds = new Set(selectedProducts.map((product) => product._id))

    return allProducts
      .filter((product) =>
        !selectedProductIds.has(product._id) &&
        matchesProductSearch(product, normalizedSearchTerm)
      )
      .sort((leftProduct, rightProduct) => {
        const rankDifference = getSearchRank(leftProduct, normalizedSearchTerm) - getSearchRank(rightProduct, normalizedSearchTerm)
        if (rankDifference !== 0) {
          return rankDifference
        }

        return String(leftProduct.name || '').localeCompare(String(rightProduct.name || ''))
      })
      .slice(0, MAX_SEARCH_RESULTS)
  }, [allProducts, debouncedSearchTerm, selectedProducts])

  const addProductToRestock = (product) => {
    if (selectedProducts.find(p => p._id === product._id)) {
      return
    }

    const defaultUnit = getDefaultRestockUnit(product)
    const baseBuyPrice = Number(product.buyPrice) || 0

    setSelectedProducts((current) => [
      ...current,
      recalculateSelectedProduct({
        ...product,
        purchaseQuantity: 0,
        restockQuantity: 0,
        restockUnitKey: defaultUnit.key,
        restockUnitName: defaultUnit.name,
        restockConversionFactor: defaultUnit.conversionFactor,
        newBuyPrice: baseBuyPrice * defaultUnit.conversionFactor,
        baseBuyPrice,
        amountOwed: 0,
        expiryDate: ''
      })
    ])
  }

  const updateSelectedProduct = (productId, field, value) => {
    setSelectedProducts((currentProducts) => currentProducts.map((product) => {
      if (product._id !== productId) {
        return product
      }

      if (field === 'restockUnitKey') {
        const selectedUnit = getRestockUnits(product).find((unit) => unit.key === value) || getDefaultRestockUnit(product)
        return recalculateSelectedProduct({
          ...product,
          restockUnitKey: selectedUnit.key,
          restockUnitName: selectedUnit.name,
          restockConversionFactor: selectedUnit.conversionFactor,
          newBuyPrice: (Number(product.baseBuyPrice) || 0) * selectedUnit.conversionFactor
        })
      }

      return recalculateSelectedProduct({
        ...product,
        [field]: value
      })
    }))
  }

  const removeProduct = (productId) => {
    setSelectedProducts((currentProducts) => currentProducts.filter(p => p._id !== productId))
  }

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier._id === invoiceSupplierId) || null,
    [invoiceSupplierId, suppliers]
  )

  const buildInvoice = (productsForInvoice) => {
    const items = productsForInvoice.map((product) => ({
      productId: product._id,
      productName: `${product.name} (${product.restockUnitName})`,
      buyPrice: Number(product.newBuyPrice),
      quantity: Number(product.purchaseQuantity),
      subtotal: Number(product.amountOwed),
      baseQuantity: Number(product.restockQuantity),
      baseUnit: getBaseUnitName(product),
      expiryDate: product.expiryDate || null
    }))

    return {
      _id: `${storeNo}:${uuidv4()}`,
      supplierId: invoiceSupplierId,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      storeNo: `${storeNo}`,
      store: `${storeNo}`
    }
  }

  const handleRestock = async () => {
    try {
      const sanitizedProducts = selectedProducts.map((product) => ({
        ...product,
        supplierId: invoiceSupplierId,
        purchaseQuantity: Number(product.purchaseQuantity) || 0,
        restockQuantity: Number(product.restockQuantity) || 0,
        restockConversionFactor: Number(product.restockConversionFactor) || 1,
        newBuyPrice: Number(product.newBuyPrice) || 0,
        baseBuyPrice: Number(product.baseBuyPrice) || 0,
        amountOwed: Number(product.amountOwed) || 0
      }))

      const isValid = Boolean(invoiceSupplierId) && sanitizedProducts.length > 0 && sanitizedProducts.every((product) =>
        product.purchaseQuantity > 0 &&
        product.restockQuantity > 0 &&
        product.newBuyPrice > 0 &&
        product.baseBuyPrice > 0 &&
        product.amountOwed >= 0
      )

      if (!isValid) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Select one supplier and fill valid quantity and buy price for each product"
        })
        return
      }

      const invoiceResult = await window.electronAPI.realmOperation('createInvoice', buildInvoice(sanitizedProducts))
      if (!invoiceResult.success) throw new Error(invoiceResult.error)

      const result = await window.electronAPI.realmOperation('restockProducts', { products: sanitizedProducts, storeNo })

      if (result.success) {
        toast({
          title: "Success",
          description: "Products restocked successfully"
        })
        setSelectedProducts([])
        setInvoiceSupplierId('')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error restocking products",
        description: error.message
      })
    }
  }

  const grandTotal = selectedProducts.reduce((sum, product) => sum + (Number(product.amountOwed) || 0), 0)

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Restock Products</h1>

      <Card className="p-4 mb-4">
        <Label htmlFor="search">Search Products</Label>
        <Input
          id="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by product name, barcode, category, or unit..."
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
                  <TableCell>{product.stock} {getBaseUnitName(product)}</TableCell>
                  <TableCell>{Number(product.buyPrice || 0).toFixed(2)} / {getBaseUnitName(product)}</TableCell>
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

        {searchTerm.trim() && products.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching products found.</p>
        )}
      </Card>

      {selectedProducts.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Selected Products</h2>
              <p className="text-sm text-muted-foreground">
                One supplier will be used for the whole invoice.
              </p>
            </div>

            <div className="w-full lg:w-[280px]">
              <Label className="mb-2 block">Invoice Supplier</Label>
              <Select value={invoiceSupplierId} onValueChange={setInvoiceSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier for this invoice" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Restock Unit</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Stock Added</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Amount Owed</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedProducts.map((product) => (
                <TableRow key={product._id}>
                  <TableCell>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Base unit: {getBaseUnitName(product)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={product.restockUnitKey}
                      onValueChange={(value) => updateSelectedProduct(product._id, 'restockUnitKey', value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRestockUnits(product).map((unit) => (
                          <SelectItem key={unit.key} value={unit.key}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={product.purchaseQuantity}
                      onChange={(e) => updateSelectedProduct(product._id, 'purchaseQuantity', Number(e.target.value))}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {product.restockQuantity} {getBaseUnitName(product)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {product.purchaseQuantity || 0} {product.restockUnitName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={product.newBuyPrice}
                        onChange={(e) => updateSelectedProduct(product._id, 'newBuyPrice', Number(e.target.value))}
                        className="w-28"
                      />
                      <p className="text-xs text-muted-foreground">
                        per {product.restockUnitName}
                      </p>
                      {Array.isArray(product.variants) && product.variants.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Variant selling prices will be recalculated from their saved margins after restock.
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={product.expiryDate}
                      onChange={(e) => updateSelectedProduct(product._id, 'expiryDate', e.target.value)}
                      className="w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{product.amountOwed.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">
                      Base buy price: {product.baseBuyPrice.toFixed(2)}
                    </div>
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

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedSupplier ? `Invoice supplier: ${selectedSupplier.name}` : 'Choose one supplier before restocking.'}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Invoice Total</p>
                <p className="text-lg font-semibold">KES {grandTotal.toFixed(2)}</p>
              </div>
              <Button onClick={handleRestock}>
                Restock Products
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
