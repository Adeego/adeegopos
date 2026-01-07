'use client'

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, Search } from 'lucide-react'
import { Input } from "@/components/ui/input"
import useWsinfoStore from '@/stores/wsinfo'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return
    fetchInvoices()
  }, [storeNo])

  const fetchInvoices = async () => {
    if (!storeNo) return
    try {
      const result = await window.electronAPI.realmOperation('getInvoices', storeNo)
      if (result.success) {
        setInvoices(result.data || [])
      } else {
        console.error('Failed to fetch invoices:', result.error)
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    }
  }

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'overdue':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const totalInvoices = invoices.length
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Supplier Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Manage and track supplier invoices
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No invoices found
              </p>
            ) : (
              filteredInvoices.map((invoice, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Invoice #{invoice.invoiceNo || index + 1}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.supplierName || 'Unknown Supplier'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold">KES {invoice.amount?.toFixed(2) || 0}</p>
                      <Badge variant={getStatusColor(invoice.status)}>
                        {invoice.status || 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
