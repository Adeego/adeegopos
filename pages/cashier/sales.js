'use client'

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { DollarSign, ShoppingCart, User, Check, History } from 'lucide-react'
import useWsinfoStore from '@/stores/wsinfo'
import useStaffStore from '@/stores/staffStore'
import RegisterBalancing from '@/components/cashier/RegisterBalancing'

export default function CashierSales() {
  const [salesData, setSalesData] = useState([])
  const [filteredSales, setFilteredSales] = useState([])
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [numberOfSales, setNumberOfSales] = useState(0)
  const [salesByPaymentMethod, setSalesByPaymentMethod] = useState({ cash: 0, phone: 0, till: 0 })
  const [creditsPaid, setCreditsPaid] = useState({ cash: 0, mpesa: 0, total: 0 })
  const [paidFilter, setPaidFilter] = useState('unpaid') // 'unpaid', 'paid', 'all'
  const [loading, setLoading] = useState(false)
  const store = useWsinfoStore((state) => state.wsinfo)
  const staff = useStaffStore((state) => state.staff)
  const [storeNo, setStoreNo] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return
    fetchTodaySales()
    fetchTransactionMetrics()
  }, [storeNo])

  useEffect(() => {
    filterSales()
  }, [salesData, paidFilter])

  const filterSales = () => {
    let filtered = [...salesData]
    if (paidFilter !== 'all') {
      const isPaid = paidFilter === 'paid'
      filtered = filtered.filter(sale => sale.paid === isPaid)
    }
    setFilteredSales(filtered)
  }

  const fetchTodaySales = async () => {
    if (!storeNo) return
    setLoading(true)
    try {
      const result = await window.electronAPI.realmOperation('getTodaySalesByPaidStatus', {
        storeNo,
        paidStatus: 'all'
      })
      if (result.success) {
        setSalesData(result.data || [])
        calculateMetrics(result.data || [])
      } else {
        console.error('Failed to fetch sales:', result.error)
        toast({
          title: "Error",
          description: "Failed to fetch sales data",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast({
        title: "Error",
        description: "An error occurred while fetching sales",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateMetrics = (sales) => {
    const paidSales = sales.filter(sale => sale.paid)
    const revenue = paidSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0)
    setTodayRevenue(revenue)
    setNumberOfSales(paidSales.length)
    
    // Calculate sales by payment method
    const byMethod = paidSales.reduce((acc, sale) => {
      const method = (sale.paymentMethod || 'CASH').toLowerCase()
      const amount = sale.totalAmount || 0
      if (method === 'cash') {
        acc.cash += amount
      } else if (method === 'phone' || method === 'mpesa' || method === 'm-pesa') {
        acc.phone += amount
      } else if (method === 'till' || method === 'card' || method === 'bank') {
        acc.till += amount
      } else {
        acc.cash += amount // Default to cash
      }
      return acc
    }, { cash: 0, phone: 0, till: 0 })
    setSalesByPaymentMethod(byMethod)
  }

  const fetchTransactionMetrics = async () => {
    if (!storeNo) return
    try {
      const result = await window.electronAPI.realmOperation('transactionMetrics', storeNo)
      if (result.success) {
        const todayData = result.data.today || {}
        setCreditsPaid({
          cash: todayData.customerCreditsCash || 0,
          mpesa: todayData.customerCreditsMpesa || 0,
          total: todayData.customerCredits || 0
        })
      } else {
        console.error('Failed to fetch transaction metrics:', result.error)
      }
    } catch (error) {
      console.error('Error fetching transaction metrics:', error)
    }
  }

  const handleMarkAsPaid = async (saleId) => {
    try {
      const result = await window.electronAPI.realmOperation('updateSalePaidStatus', {
        saleId,
        paidStatus: true
      })
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Sale marked as paid successfully"
        })
        // Refresh the sales data
        fetchTodaySales()
      } else {
        toast({
          title: "Error",
          description: "Failed to update sale status",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error updating sale:', error)
      toast({
        title: "Error",
        description: "An error occurred while updating sale",
        variant: "destructive"
      })
    }
  }

  const handleFilterChange = (value) => {
    setPaidFilter(value)
  }

  return (
    <div className="">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cashier Sales</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <RegisterBalancing todaySales={salesByPaymentMethod} creditsPaid={creditsPaid} />
          <Link href="/pos/salesHistory">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              Sales History
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {todayRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Count</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberOfSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashier</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staff.firstName || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Today's Sales</CardTitle>
              <CardDescription>Manage and track today's sales transactions</CardDescription>
            </div>
            <Tabs value={paidFilter} onValueChange={handleFilterChange}>
              <TabsList>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No {paidFilter !== 'all' ? paidFilter : ''} sales found for today
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell>
                      {new Date(sale.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sale.customerId || 'Walk-in'}
                    </TableCell>
                    <TableCell>{sale.totalItems || 0}</TableCell>
                    <TableCell>
                      <Badge variant={sale.paymentMethod === 'CASH' ? 'default' : 'secondary'}>
                        {sale.paymentMethod || 'CASH'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">
                      KES {sale.totalAmount?.toFixed(2) || 0}
                    </TableCell>
                    <TableCell>
                      {sale.paid ? (
                        <Badge variant="success" className="bg-green-500">Paid</Badge>
                      ) : (
                        <Badge variant="destructive">Unpaid</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!sale.paid && (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(sale._id)}
                          className="h-8"
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
