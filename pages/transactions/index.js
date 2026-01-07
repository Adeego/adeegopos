'use client'

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react'
import useWsinfoStore from '@/stores/wsinfo'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [customerPayments, setCustomerPayments] = useState([])
  const [supplierPayments, setSupplierPayments] = useState([])
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return
    fetchTransactions()
  }, [storeNo])

  const fetchTransactions = async () => {
    if (!storeNo) return
    try {
      const result = await window.electronAPI.realmOperation('getAllTransactions', storeNo)
      if (result.success) {
        const allTransactions = result.data || []
        setTransactions(allTransactions)
        
        // Separate customer and supplier payments
        const customerPmt = allTransactions.filter(t => t.type === 'customer_payment')
        const supplierPmt = allTransactions.filter(t => t.type === 'supplier_payment')
        
        setCustomerPayments(customerPmt)
        setSupplierPayments(supplierPmt)
      } else {
        console.error('Failed to fetch transactions:', result.error)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const TransactionList = ({ transactions, type }) => (
    <div className="space-y-4">
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No {type} transactions found
        </p>
      ) : (
        transactions.map((transaction, index) => (
          <div key={index} className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              {transaction.type === 'customer_payment' ? (
                <div className="p-2 bg-green-100 rounded-full">
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                </div>
              ) : (
                <div className="p-2 bg-red-100 rounded-full">
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {transaction.customerName || transaction.supplierName || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(transaction.createdAt).toLocaleDateString()} at{' '}
                  {new Date(transaction.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">KES {transaction.amount?.toFixed(2) || 0}</p>
              <Badge variant={transaction.paymentMethod === 'cash' ? 'default' : 'secondary'}>
                {transaction.paymentMethod || 'Cash'}
              </Badge>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const totalCustomerPayments = customerPayments.reduce((sum, t) => sum + (t.amount || 0), 0)
  const totalSupplierPayments = supplierPayments.reduce((sum, t) => sum + (t.amount || 0), 0)

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          View all customer and supplier payment transactions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Payments</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              KES {totalCustomerPayments.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {customerPayments.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supplier Payments</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              KES {totalSupplierPayments.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {supplierPayments.length} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Customer and supplier payment history</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <TransactionList transactions={transactions} type="all" />
            </TabsContent>
            <TabsContent value="customers" className="mt-4">
              <TransactionList transactions={customerPayments} type="customer" />
            </TabsContent>
            <TabsContent value="suppliers" className="mt-4">
              <TransactionList transactions={supplierPayments} type="supplier" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
