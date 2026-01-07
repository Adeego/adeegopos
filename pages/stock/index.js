import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, DollarSign, TrendingUp, Package, ArrowRight } from "lucide-react"
import useWsinfoStore from '@/stores/wsinfo'
import Link from 'next/link'

export default function StockDashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalCost: 0,
    totalValue: 0,
    totalProfit: 0,
    lowStockCount: 0
  })
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (storeNo) {
      loadProducts()
    }
  }, [storeNo])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const result = await window.electronAPI.realmOperation('getAllProducts', storeNo)
      
      if (result.success) {
        const allProducts = result.products
        
        // Filter products with low stock (stock <= restockThreshold)
        const lowStockProducts = allProducts.filter(product => {
          const threshold = product.restockThreshold || 10
          return product.stock <= threshold
        })

        // Calculate inventory metrics
        const totalCost = allProducts.reduce((sum, product) => {
          return sum + (product.buyPrice * product.stock)
        }, 0)

        const totalValue = allProducts.reduce((sum, product) => {
          // Find variant with conversion factor of 1
          const baseVariant = product.variants && product.variants.length > 0
            ? product.variants.find(variant => variant.conversionFactor === 1)
            : null
          
          // Use base variant's unit price if found, otherwise use buyPrice * 1.2
          const sellingPrice = baseVariant 
            ? baseVariant.unitPrice 
            : product.buyPrice * 1.2
          
          return sum + (sellingPrice * product.stock)
        }, 0)

        setProducts(lowStockProducts)
        setMetrics({
          totalCost: totalCost,
          totalValue: totalValue,
          totalProfit: totalValue - totalCost,
          lowStockCount: lowStockProducts.length
        })
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStockStatus = (product) => {
    const threshold = product.restockThreshold || 10
    const stock = product.stock

    if (stock === 0) {
      return { label: 'Out of Stock', color: 'destructive' }
    } else if (stock <= threshold * 0.5) {
      return { label: 'Critical', color: 'destructive' }
    } else if (stock <= threshold) {
      return { label: 'Low', color: 'warning' }
    }
    return { label: 'Normal', color: 'default' }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-lg text-neutral-500">Loading stock data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Stock Management</h1>
          <p className="text-neutral-500 mt-1">Monitor inventory levels and stock alerts</p>
        </div>
        <Link href="/product/restock">
          <Button className="gap-2">
            Restock Products
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalCost)}</div>
            <p className="text-xs text-neutral-500 mt-1">
              Total buying price of all stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
            <p className="text-xs text-neutral-500 mt-1">
              Total selling price of all stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(metrics.totalProfit)}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {((metrics.totalProfit / metrics.totalCost) * 100).toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics.lowStockCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Items requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Low Stock Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-neutral-600">All stock levels are healthy</p>
              <p className="text-sm text-neutral-500 mt-2">No items require immediate restocking</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-center">Current Stock</TableHead>
                    <TableHead className="text-center">Threshold</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Buy Price</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const status = getStockStatus(product)
                    const threshold = product.restockThreshold || 10
                    const stockValue = product.buyPrice * product.stock

                    return (
                      <TableRow key={product._id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold ${
                            product.stock === 0 
                              ? 'text-red-600' 
                              : product.stock <= threshold * 0.5 
                              ? 'text-orange-600' 
                              : 'text-neutral-900'
                          }`}>
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-neutral-600">
                          {threshold}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.color}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.buyPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(stockValue)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
