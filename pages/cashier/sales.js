'use client'

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { DollarSign, ShoppingCart, User, Check, History, AlertCircle, Calendar } from 'lucide-react'
import useWsinfoStore from '@/stores/wsinfo'
import useStaffStore from '@/stores/staffStore'
import RegisterBalancing from '@/components/cashier/RegisterBalancing'

const getSalePaymentBreakdown = (sale = {}) => {
  const total = Number(sale.netTotalAmount ?? sale.totalAmount ?? 0) || 0
  const sign = total < 0 ? -1 : 1
  const payments = Array.isArray(sale.paymentBreakdown) && sale.paymentBreakdown.length > 0
    ? sale.paymentBreakdown
    : [{ method: sale.paymentMethod || 'CASH', amount: Math.abs(total), transactionCost: Number(sale.transactionCost) || 0 }]

  return payments.map(payment => ({
    method: String(payment.method || payment.paymentMethod || 'CASH').toLowerCase(),
    amount: (Number(payment.amount) || 0) * sign,
    transactionCost: Number(payment.transactionCost) || 0
  }))
}

export default function CashierSales() {
  const [salesData, setSalesData] = useState([])
  const [filteredSales, setFilteredSales] = useState([])
  const [beforeTodaySales, setBeforeTodaySales] = useState([])
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [numberOfSales, setNumberOfSales] = useState(0)
  const [salesByPaymentMethod, setSalesByPaymentMethod] = useState({
    cash: { gross: 0, transactionCost: 0, net: 0 },
    phone: { gross: 0, transactionCost: 0, net: 0 },
    till: { gross: 0, transactionCost: 0, net: 0 }
  })
  const [creditsPaid, setCreditsPaid] = useState({
    cash: 0,
    mpesa: 0,
    total: 0,
    grossCash: 0,
    grossMpesa: 0,
    grossTotal: 0,
    transactionCostCash: 0,
    transactionCostMpesa: 0,
    transactionCostTotal: 0
  })
  const [paidFilter, setPaidFilter] = useState('unpaid')
  const [mainTab, setMainTab] = useState('today')
  const [loading, setLoading] = useState(false)
  const [loadingBefore, setLoadingBefore] = useState(false)
  const store = useWsinfoStore((state) => state.wsinfo)
  const staff = useStaffStore((state) => state.staff)
  const [storeNo, setStoreNo] = useState('')
  const { toast } = useToast()
  const router = useRouter()
  const openRegisterBalancing = router.query.balance === '1'

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return
    fetchTodaySales()
    fetchBeforeTodaySales()
    fetchTransactionMetrics()
  }, [storeNo])

  useEffect(() => {
    filterSales()
  }, [salesData, paidFilter])

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.tab === 'before') {
      setMainTab('before')
      setPaidFilter('unpaid')
    }
  }, [router.isReady, router.query.tab])

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

  const fetchBeforeTodaySales = async () => {
    if (!storeNo) return
    setLoadingBefore(true)
    try {
      const result = await window.electronAPI.realmOperation('getUnpaidSalesBeforeToday', storeNo)
      if (result.success) {
        setBeforeTodaySales(result.data || [])
      } else {
        console.error('Failed to fetch before-today sales:', result.error)
      }
    } catch (error) {
      console.error('Error fetching before-today sales:', error)
    } finally {
      setLoadingBefore(false)
    }
  }

  const calculateMetrics = (sales) => {
    const paidSales = sales.filter(sale => sale.paid)
    const revenue = paidSales.reduce((sum, sale) => sum + Number(sale.netTotalAmount ?? sale.totalAmount ?? 0), 0)
    setTodayRevenue(revenue)
    setNumberOfSales(paidSales.length)
    
    // Calculate sales by payment method
    const byMethod = paidSales.reduce((acc, sale) => {
      getSalePaymentBreakdown(sale).forEach((payment) => {
        const method = payment.method
        const amount = payment.amount
        const transactionCost = payment.transactionCost
        const netAmount = amount - transactionCost

        if (method === 'cash') {
          acc.cash.gross += amount
          acc.cash.transactionCost += transactionCost
          acc.cash.net += netAmount
        } else if (method === 'phone' || method === 'mpesa' || method === 'm-pesa') {
          acc.phone.gross += amount
          acc.phone.transactionCost += transactionCost
          acc.phone.net += netAmount
        } else if (method === 'till' || method === 'card' || method === 'bank') {
          acc.till.gross += amount
          acc.till.transactionCost += transactionCost
          acc.till.net += netAmount
        } else {
          acc.cash.gross += amount
          acc.cash.transactionCost += transactionCost
          acc.cash.net += netAmount
        }
      })
      return acc
    }, {
      cash: { gross: 0, transactionCost: 0, net: 0 },
      phone: { gross: 0, transactionCost: 0, net: 0 },
      till: { gross: 0, transactionCost: 0, net: 0 }
    })
    setSalesByPaymentMethod(byMethod)
  }

  const fetchTransactionMetrics = async () => {
    if (!storeNo) return
    try {
      const result = await window.electronAPI.realmOperation('transactionMetrics', storeNo)
      if (result.success) {
        const todayData = result.data.today || {}
        setCreditsPaid({
          cash: todayData.customerCreditsCashNet || 0,
          mpesa: todayData.customerCreditsMpesaNet || 0,
          total: todayData.customerCreditsNet || 0,
          grossCash: todayData.customerCreditsCash || 0,
          grossMpesa: todayData.customerCreditsMpesa || 0,
          grossTotal: todayData.customerCredits || 0,
          transactionCostCash: todayData.transactionCostsCash || 0,
          transactionCostMpesa: todayData.transactionCostsMpesa || 0,
          transactionCostTotal: todayData.transactionCostsTotal || 0
        })
      } else {
        console.error('Failed to fetch transaction metrics:', result.error)
      }
    } catch (error) {
      console.error('Error fetching transaction metrics:', error)
    }
  }

  const handleMarkAsPaid = async (sale, isBefore = false) => {
    try {
      const hasMpesa = getSalePaymentBreakdown(sale).some((payment) => /mpesa|m-pesa|m pesa|phone|till/.test(payment.method))
      const mpesaReference = hasMpesa ? window.prompt('Enter the unique M-Pesa receipt/reference') : ''
      if (hasMpesa && !mpesaReference?.trim()) return
      const result = await window.electronAPI.realmOperation('updateSalePaidStatus', {
        saleId: sale._id,
        paidStatus: true,
        mpesaReference: mpesaReference?.trim() || null
      })
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Sale marked as paid successfully"
        })
        if (isBefore) {
          fetchBeforeTodaySales()
        } else {
          fetchTodaySales()
        }
      } else {
        toast({
          title: "Error",
            description: result.error || "Failed to update sale status",
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

  const beforeTodayTotal = beforeTodaySales.reduce((sum, sale) => sum + Number(sale.netTotalAmount ?? sale.totalAmount ?? 0), 0)
  const hasMoneyTender = (sale) => getSalePaymentBreakdown(sale).some((payment) => payment.method !== 'credit')

  const SalesTable = ({ sales, showDate = false, isBefore = false }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{showDate ? 'Date' : 'Time'}</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale._id}>
            <TableCell>
              {showDate ? (
                new Date(sale.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              ) : (
                new Date(sale.createdAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              )}
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
              KES {Number(sale.netTotalAmount ?? sale.totalAmount ?? 0).toFixed(2)}
            </TableCell>
            <TableCell>
              {sale.paid ? (
                <Badge variant="success" className="bg-green-500">Paid</Badge>
              ) : (
                <Badge variant="destructive">Unpaid</Badge>
              )}
            </TableCell>
            <TableCell>
              {!sale.paid && hasMoneyTender(sale) && (
                <Button
                  size="sm"
                  onClick={() => handleMarkAsPaid(sale, isBefore)}
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
  )

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
          <RegisterBalancing todaySales={salesByPaymentMethod} creditsPaid={creditsPaid} defaultOpen={openRegisterBalancing} />
          <Link href="/pos/salesHistory">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              Sales History
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Revenue</CardTitle>
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
            <CardTitle className="text-sm font-medium">Unpaid (Before Today)</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              KES {beforeTodayTotal.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{beforeTodaySales.length} sale(s)</p>
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

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Today&apos;s Sales
            <Badge variant="secondary" className="ml-1">{salesData.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="before" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Before Today
            {beforeTodaySales.length > 0 && (
              <Badge variant="destructive" className="ml-1">{beforeTodaySales.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Today&apos;s Sales</CardTitle>
                  <CardDescription>Manage and track today&apos;s sales transactions</CardDescription>
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
                <SalesTable sales={filteredSales} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="before">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Unpaid Sales (Before Today)</CardTitle>
                <CardDescription>Outstanding unpaid sales from previous days</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBefore ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : beforeTodaySales.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No outstanding unpaid sales</p>
                </div>
              ) : (
                <SalesTable sales={beforeTodaySales} showDate isBefore />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
