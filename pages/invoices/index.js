'use client'

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Calendar, Eye, FileText, Package, Search, ShoppingCart, Users } from "lucide-react"
import InvoiceReconciliationDialog from "@/components/reconciliation/InvoiceReconciliationDialog"
import ReconciliationHistory from "@/components/reconciliation/ReconciliationHistory"
import useWsinfoStore from "@/stores/wsinfo"

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES'
})

const formatInvoiceRef = (invoice) => {
  const rawId = invoice?._id || ''
  const ref = rawId.includes(':') ? rawId.split(':').pop() : rawId

  if (!ref) {
    return 'N/A'
  }

  return `INV-${ref.slice(0, 8).toUpperCase()}`
}

const getSupplierName = (invoice) => {
  return invoice?.supplier?.name || invoice?.supplierName || 'Unknown Supplier'
}

const getLineItemsCount = (invoice) => {
  return invoice?.items?.length || 0
}

const getTotalUnits = (invoice) => {
  if (typeof invoice?.totalItems === 'number') {
    return invoice.totalItems
  }

  return (invoice?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
}

const filterInvoices = (invoices, searchTerm) => {
  const normalizedTerm = searchTerm.trim().toLowerCase()

  if (!normalizedTerm) {
    return invoices
  }

  return invoices.filter((invoice) => {
    const supplierName = getSupplierName(invoice).toLowerCase()
    const invoiceRef = formatInvoiceRef(invoice).toLowerCase()
    const rawId = String(invoice?._id || '').toLowerCase()

    return supplierName.includes(normalizedTerm) || invoiceRef.includes(normalizedTerm) || rawId.includes(normalizedTerm)
  })
}

export default function Invoices() {
  const router = useRouter()
  const [monthlyInvoices, setMonthlyInvoices] = useState([])
  const [historyInvoices, setHistoryInvoices] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [mainTab, setMainTab] = useState('monthly')
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [selectedReconciliations, setSelectedReconciliations] = useState([])
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false)
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (store?.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return

    const loadInvoices = async () => {
      setLoadingMonthly(true)
      setLoadingHistory(true)

      try {
        const [monthlyResult, historyResult] = await Promise.all([
          window.electronAPI.realmOperation('getInvoices', { storeNo, period: 'monthly' }),
          window.electronAPI.realmOperation('getInvoices', { storeNo, period: 'all' })
        ])

        if (monthlyResult.success) {
          setMonthlyInvoices(monthlyResult.data || [])
        } else {
          console.error('Failed to fetch monthly invoices:', monthlyResult.error)
          toast({
            title: "Error",
            description: "Failed to fetch monthly invoices",
            variant: "destructive"
          })
        }

        if (historyResult.success) {
          setHistoryInvoices(historyResult.data || [])
        } else {
          console.error('Failed to fetch invoice history:', historyResult.error)
          toast({
            title: "Error",
            description: "Failed to fetch invoice history",
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error('Error fetching invoices:', error)
        toast({
          title: "Error",
          description: "An error occurred while fetching invoices",
          variant: "destructive"
        })
      } finally {
        setLoadingMonthly(false)
        setLoadingHistory(false)
      }
    }

    loadInvoices()
  }, [storeNo, toast])

  const fetchInvoiceReconciliations = useCallback(async (invoiceId) => {
    if (!invoiceId || !storeNo) {
      setSelectedReconciliations([])
      return
    }

    try {
      const result = await window.electronAPI.realmOperation('getReconciliationBySource', 'invoice', invoiceId, storeNo)
      if (result.success) {
        setSelectedReconciliations(result.reconciliations || [])
      } else {
        console.error('Failed to fetch invoice reconciliations:', result.error)
        setSelectedReconciliations([])
      }
    } catch (error) {
      console.error('Error fetching invoice reconciliations:', error)
      setSelectedReconciliations([])
    }
  }, [storeNo])

  const handleViewInvoice = useCallback(async (invoiceId) => {
    setLoadingInvoiceDetails(true)
    setIsInvoiceDialogOpen(true)

    try {
      const [result] = await Promise.all([
        window.electronAPI.realmOperation('getInvoiceById', invoiceId),
        fetchInvoiceReconciliations(invoiceId)
      ])

      if (result.success) {
        setSelectedInvoice(result.invoice || null)
        setSelectedSupplier(result.supplier || null)
      } else {
        setIsInvoiceDialogOpen(false)
        toast({
          title: "Error",
          description: "Failed to load invoice details",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error)
      setIsInvoiceDialogOpen(false)
      toast({
        title: "Error",
        description: "An error occurred while loading invoice details",
        variant: "destructive"
      })
    } finally {
      setLoadingInvoiceDetails(false)
    }
  }, [fetchInvoiceReconciliations, toast])

  useEffect(() => {
    if (!storeNo || !router.isReady || !router.query.invoiceId) return
    handleViewInvoice(String(router.query.invoiceId))
  }, [storeNo, router.isReady, router.query.invoiceId, handleViewInvoice])

  const filteredMonthlyInvoices = useMemo(
    () => filterInvoices(monthlyInvoices, searchTerm),
    [monthlyInvoices, searchTerm]
  )

  const filteredHistoryInvoices = useMemo(
    () => filterInvoices(historyInvoices, searchTerm),
    [historyInvoices, searchTerm]
  )

  const activeMonthlyInvoices = monthlyInvoices.filter((invoice) => invoice.status !== 'voided')
  const monthlySpend = activeMonthlyInvoices.reduce((sum, invoice) => sum + (Number(invoice.totalAmount) || 0), 0)
  const monthlyInvoiceCount = activeMonthlyInvoices.length
  const monthlyUnits = activeMonthlyInvoices.reduce((sum, invoice) => sum + getTotalUnits(invoice), 0)
  const monthlySuppliers = new Set(activeMonthlyInvoices.map(invoice => invoice.supplierId).filter(Boolean)).size

  const InvoiceTable = ({ invoices, showDate = false, loading = false, emptyMessage }) => {
    if (loading) {
      return <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
    }

    if (invoices.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          {emptyMessage}
        </p>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{showDate ? 'Date' : 'Time'}</TableHead>
              <TableHead>Invoice Ref</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Line Items</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice._id}>
                <TableCell>
                  {showDate ? (
                    new Date(invoice.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  ) : (
                    new Date(invoice.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  )}
                </TableCell>
                <TableCell className="font-medium">{formatInvoiceRef(invoice)}</TableCell>
                <TableCell>{getSupplierName(invoice)}</TableCell>
                <TableCell>{getLineItemsCount(invoice)}</TableCell>
                <TableCell>{getTotalUnits(invoice)}</TableCell>
                <TableCell className="font-bold">
                  {currencyFormatter.format(Number(invoice.totalAmount) || 0)}
                </TableCell>
                <TableCell>
                  <Badge variant={invoice.status === 'voided' ? 'destructive' : invoice.status === 'adjusted' ? 'secondary' : 'outline'}>
                    {invoice.status || 'posted'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewInvoice(invoice._id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supplier Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex w-full max-w-md items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier or invoice ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month&apos;s Spend</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(monthlySpend)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month&apos;s Invoices</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyInvoiceCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Received This Month</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyUnits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers This Month</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlySuppliers}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            This Month
            <Badge variant="secondary" className="ml-1">{monthlyInvoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoice History
            <Badge variant="secondary" className="ml-1">{historyInvoices.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>This Month&apos;s Invoices</CardTitle>
              <CardDescription>Track supplier invoices created during this month&apos;s restocking activity</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceTable
                invoices={filteredMonthlyInvoices}
                showDate
                loading={loadingMonthly}
                emptyMessage={searchTerm ? 'No invoices match your search this month' : 'No invoices found for this month'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>Review all supplier invoices and inspect invoice line items</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceTable
                invoices={filteredHistoryInvoices}
                showDate
                loading={loadingHistory}
                emptyMessage={searchTerm ? 'No invoices match your search in history' : 'No invoice history found'}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isInvoiceDialogOpen}
        onOpenChange={(open) => {
          setIsInvoiceDialogOpen(open)
          if (!open) {
            setSelectedInvoice(null)
            setSelectedSupplier(null)
            setSelectedReconciliations([])
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>Detailed information for the selected supplier invoice</DialogDescription>
          </DialogHeader>

          {loadingInvoiceDetails ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading invoice details...</p>
          ) : selectedInvoice ? (
            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Supplier</h4>
                    <p className="text-lg font-semibold">
                      {selectedSupplier?.name || getSupplierName(selectedInvoice)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Invoice Reference</h4>
                    <p className="text-lg font-semibold">{formatInvoiceRef(selectedInvoice)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Created At</h4>
                    <p className="text-lg font-semibold">
                      {new Date(selectedInvoice.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Total Amount</h4>
                    <p className="text-lg font-semibold">
                      {currencyFormatter.format(Number(selectedInvoice.totalAmount) || 0)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                    <Badge variant={selectedInvoice.status === 'voided' ? 'destructive' : selectedInvoice.status === 'adjusted' ? 'secondary' : 'outline'}>
                      {selectedInvoice.status || 'posted'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
                    <p className="text-lg font-semibold">{getLineItemsCount(selectedInvoice)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Total Units</h4>
                    <p className="text-lg font-semibold">{getTotalUnits(selectedInvoice)}</p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 text-lg font-semibold">Invoice Items</h4>
                  {(selectedInvoice.items || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No line items available for this invoice.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Buy Price</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedInvoice.items.map((item, index) => (
                            <TableRow key={`${item.productId || item.productName || 'item'}-${index}`}>
                              <TableCell>{item.productName || 'Unnamed Product'}</TableCell>
                              <TableCell>{Number(item.quantity) || 0}</TableCell>
                              <TableCell>{currencyFormatter.format(Number(item.buyPrice) || 0)}</TableCell>
                              <TableCell>{currencyFormatter.format(Number(item.subtotal) || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <InvoiceReconciliationDialog
                    invoice={selectedInvoice}
                    mode="adjust"
                    onSuccess={() => fetchInvoiceReconciliations(selectedInvoice._id)}
                  />
                  <InvoiceReconciliationDialog
                    invoice={selectedInvoice}
                    mode="void"
                    onSuccess={() => fetchInvoiceReconciliations(selectedInvoice._id)}
                  />
                </div>

                <ReconciliationHistory
                  reconciliations={selectedReconciliations}
                  description="Correction cases linked to this supplier invoice"
                />
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No invoice selected</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
