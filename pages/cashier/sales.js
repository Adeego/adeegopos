'use client'

import React, { useCallback, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { DollarSign, ShoppingCart, User, Check, History, AlertCircle, Clock, Eye } from 'lucide-react'
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
  const [pendingSales, setPendingSales] = useState({ currentMonth: [], lastMonth: [], ranges: {} })
  const [shiftRevenue, setShiftRevenue] = useState(0)
  const [numberOfSales, setNumberOfSales] = useState(0)
  const [activeShift, setActiveShift] = useState(null)
  const [paidFilter, setPaidFilter] = useState('unpaid')
  const [mainTab, setMainTab] = useState('shift')
  const [loading, setLoading] = useState(false)
  const [loadingPending, setLoadingPending] = useState(false)
  const [pendingPeriod, setPendingPeriod] = useState('currentMonth')
  const [confirmingSaleId, setConfirmingSaleId] = useState(null)
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
    if (!router.isReady) return
    if (router.query.tab === 'before' || router.query.tab === 'pending') {
      setMainTab('pending')
      setPaidFilter('unpaid')
    }
  }, [router.isReady, router.query.tab])

  const filteredSales = useMemo(() => {
    if (paidFilter === 'all') return salesData
    const isPaid = paidFilter === 'paid'
    return salesData.filter((sale) => sale.paid === isPaid)
  }, [salesData, paidFilter])

  const fetchShiftSales = useCallback(async () => {
    if (!storeNo) return
    setLoading(true)
    try {
      const shiftResult = await window.electronAPI.realmOperation('getRegisterSession', storeNo)
      if (!shiftResult.success) throw new Error(shiftResult.error)

      const shift = shiftResult.activeSession || null
      setActiveShift(shift)
      if (!shift) {
        setSalesData([])
        setShiftRevenue(0)
        setNumberOfSales(0)
        return
      }

      const result = await window.electronAPI.realmOperation('getShiftSales', {
        storeNo,
        registerSessionId: shift._id
      })
      if (result.success) {
        const sales = result.data || []
        const paidSales = sales.filter((sale) => sale.paid)
        setSalesData(sales)
        setShiftRevenue(paidSales.reduce((sum, sale) => sum + Number(sale.netTotalAmount ?? sale.totalAmount ?? 0), 0))
        setNumberOfSales(paidSales.length)
      } else {
        console.error('Failed to fetch sales:', result.error)
        toast({
          title: "Error",
          description: result.error || "Failed to fetch sales data",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast({
        title: "Error",
        description: error.message || "An error occurred while fetching sales",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [storeNo, toast])

  const fetchPendingSales = useCallback(async () => {
    if (!storeNo) return
    setLoadingPending(true)
    try {
      const result = await window.electronAPI.realmOperation('getPendingSalesByMonth', {
        storeNo,
        referenceDate: new Date().toISOString()
      })
      if (result.success) {
        setPendingSales(result.data || { currentMonth: [], lastMonth: [], ranges: {} })
      } else {
        console.error('Failed to fetch pending sales:', result.error)
        toast({ title: 'Error', description: result.error || 'Failed to fetch pending sales', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error fetching pending sales:', error)
      toast({ title: 'Error', description: error.message || 'An error occurred while fetching pending sales', variant: 'destructive' })
    } finally {
      setLoadingPending(false)
    }
  }, [storeNo, toast])

  useEffect(() => {
    if (!storeNo) return
    fetchShiftSales()
    fetchPendingSales()
  }, [storeNo, fetchShiftSales, fetchPendingSales])

  const handleMarkAsPaid = async (sale) => {
    setConfirmingSaleId(sale._id)
    try {
      const result = await window.electronAPI.realmOperation('updateSalePaidStatus', {
        saleId: sale._id,
        paidStatus: true
      })
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Sale marked as paid successfully"
        })
        fetchShiftSales()
        fetchPendingSales()
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
        description: error.message || "An error occurred while updating sale",
        variant: "destructive"
      })
    } finally {
      setConfirmingSaleId(null)
    }
  }

  const handleFilterChange = (value) => {
    setPaidFilter(value)
  }

  const hasMoneyTender = (sale) => getSalePaymentBreakdown(sale).some((payment) => payment.method !== 'credit' && payment.amount !== 0)
  const getPendingTenderAmount = (sale) => getSalePaymentBreakdown(sale)
    .filter((payment) => payment.method !== 'credit')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const allPendingSales = useMemo(
    () => [...pendingSales.currentMonth, ...pendingSales.lastMonth],
    [pendingSales.currentMonth, pendingSales.lastMonth]
  )
  const pendingTenderTotal = useMemo(
    () => allPendingSales.reduce((sum, sale) => sum + getPendingTenderAmount(sale), 0),
    [allPendingSales]
  )
  const pendingTenderCount = useMemo(
    () => allPendingSales.filter(hasMoneyTender).length,
    [allPendingSales]
  )
  const monthLabel = (range) => range?.start
    ? new Date(range.start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  const SalesTable = ({ sales, showDate = false, showDetails = false }) => (
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
                <div>
                  <div>{new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
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
              <div className="flex flex-wrap gap-2">
                {showDetails && (
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <Link href={`/pos/${sale._id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      View Details
                    </Link>
                  </Button>
                )}
                {!sale.paid && hasMoneyTender(sale) && (
                  <Button
                    size="sm"
                    onClick={() => handleMarkAsPaid(sale)}
                    disabled={confirmingSaleId === sale._id}
                    className="h-8"
                  >
                    <Check className="mr-1 h-4 w-4" />
                    {confirmingSaleId === sale._id ? 'Confirming...' : 'Mark Paid'}
                  </Button>
                )}
              </div>
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
            {activeShift
              ? `Shift opened ${new Date(activeShift.openedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'No register shift is currently open'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cashier/shifts"><Button variant="outline"><History className="mr-2 h-4 w-4" />Shift History</Button></Link>
          <RegisterBalancing defaultOpen={openRegisterBalancing} onShiftChange={fetchShiftSales} />
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
            <CardTitle className="text-sm font-medium">Shift Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {shiftRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shift Sales Count</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberOfSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Cash/M-Pesa</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              KES {pendingTenderTotal.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingTenderCount} unpaid sale(s) across this month and last month
            </p>
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
          <TabsTrigger value="shift" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Shift Sales
            <Badge variant="secondary" className="ml-1">{salesData.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Pending Sales
            {allPendingSales.length > 0 && (
              <Badge variant="destructive" className="ml-1">{allPendingSales.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shift">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Current Shift Sales</CardTitle>
                  <CardDescription>Manage and track sales recorded during the active register shift</CardDescription>
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
              ) : !activeShift ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Open a register shift to start tracking shift sales
                </p>
              ) : filteredSales.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No {paidFilter !== 'all' ? paidFilter : ''} sales found for this shift
                </p>
              ) : (
                <SalesTable sales={filteredSales} showDetails />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Pending Sales</CardTitle>
                <CardDescription>
                  All sales still marked unpaid, divided between the current and previous calendar month
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : (
                <Tabs value={pendingPeriod} onValueChange={setPendingPeriod}>
                  <TabsList className="mb-4 grid h-auto w-full grid-cols-2">
                    <TabsTrigger value="currentMonth" className="flex flex-col gap-1 py-2">
                      <span>{monthLabel(pendingSales.ranges.currentMonth) || 'Current Month'}</span>
                      <Badge variant="secondary">{pendingSales.currentMonth.length} pending</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="lastMonth" className="flex flex-col gap-1 py-2">
                      <span>{monthLabel(pendingSales.ranges.lastMonth) || 'Last Month'}</span>
                      <Badge variant="secondary">{pendingSales.lastMonth.length} pending</Badge>
                    </TabsTrigger>
                  </TabsList>

                  {['currentMonth', 'lastMonth'].map((period) => {
                    const periodSales = pendingSales[period]
                    const periodTotal = periodSales.reduce((sum, sale) => sum + getPendingTenderAmount(sale), 0)
                    const label = monthLabel(pendingSales.ranges[period]) || (period === 'currentMonth' ? 'Current Month' : 'Last Month')
                    return (
                      <TabsContent key={period} value={period}>
                        <div className="mb-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border p-4">
                            <p className="text-xs text-muted-foreground">Pending sales in {label}</p>
                            <p className="text-xl font-bold">{periodSales.length}</p>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-xs text-muted-foreground">Pending cash/M-Pesa amount</p>
                            <p className="text-xl font-bold text-destructive">KES {periodTotal.toFixed(2)}</p>
                          </div>
                        </div>
                        {periodSales.length === 0 ? (
                          <div className="py-8 text-center">
                            <Check className="mx-auto mb-2 h-10 w-10 text-green-500" />
                            <p className="text-sm text-muted-foreground">No pending sales for {label}</p>
                          </div>
                        ) : (
                          <SalesTable sales={periodSales} showDate />
                        )}
                      </TabsContent>
                    )
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}
