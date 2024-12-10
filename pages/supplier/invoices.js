'use client'

import React, { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function Invoices() {
  const [invoices, setInvoices] = useState(null)
  const [paidInvoices, setPaidInvoices] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [supplier, setSupplier] = useState(null)
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)

  useEffect(() => {
    fetchinvoices();
    fetchtrans();
  }, [])

  const fetchinvoices = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodayInvoices');
      if (result.success) {
        setInvoices(result.invoices)
      } else {
        console.error('Failed to fetch invoices:', result.error);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchtrans = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodayTransactions');
      if (result.success) {
        setPaidInvoices(result.transactions)
      } else {
        console.error('Failed to fetch transactions:', result.error);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchSelectedInvoice = async (invoiceId) => {
    try {
      const result = await window.electronAPI.realmOperation('getInvoiceById', invoiceId);
      if (result.success) {
        setSelectedInvoice(result.invoice);
        setSupplier(result.supplier);
        setIsInvoiceDialogOpen(true);
      } else {
        console.error('Failed to fetch invoice:', result.error);
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    }
  }

  const renderInvoicesTable = (data) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center text-gray-500 py-4">
          No invoices found
        </div>
      )
    }

    return (
      <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>A list of all supplier invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Supplier</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Total Items</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((invoice) => (
                <TableRow key={invoice._id}>
                  <TableCell className="font-medium">{invoice.supplier.name || 'N/A'}</TableCell>
                  <TableCell>KES {invoice.totalAmount.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>{invoice.totalItems || 0}</TableCell>
                  <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchSelectedInvoice(invoice._id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Detailed information about the selected invoice
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Supplier</h4>
                    <p className="text-lg font-semibold">{supplier.name || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Total Amount</h4>
                    <p className="text-lg font-semibold">KES {selectedInvoice.totalAmount.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Total Items</h4>
                    <p className="text-lg font-semibold">{selectedInvoice.totalItems || 0}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Date</h4>
                    <p className="text-lg font-semibold">{new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                  <div>
                    <h4 className="mb-4 text-lg font-semibold">Invoice Items</h4>
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
                          <TableRow key={index}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>KES {item.buyPrice.toFixed(2)}</TableCell>
                            <TableCell>KES {(item.quantity * item.buyPrice).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
    )
  }

  const renderPaidInvoicesTable = (data) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center text-gray-500 py-4">
          No paid invoices found
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction ID</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((transaction) => (
            <TableRow key={transaction._id}>
              <TableCell>{transaction._id}</TableCell>
              <TableCell>{transaction.from}</TableCell>
              <TableCell>{transaction.to}</TableCell>
              <TableCell>{(transaction.amount || 0)}</TableCell>
              <TableCell>{transaction.description || 'No description'}</TableCell>
              <TableCell>{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Invoices (Today)</h2>
      <Tabs defaultValue="received" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="received">Invoices received</TabsTrigger>
          <TabsTrigger value="paid">Invoices paid</TabsTrigger>
        </TabsList>
        <TabsContent value="received">
          {renderInvoicesTable(invoices)}
        </TabsContent>
        <TabsContent value="paid">
          {renderPaidInvoicesTable(paidInvoices)}
        </TabsContent>
      </Tabs>
    </div>
  )
}
