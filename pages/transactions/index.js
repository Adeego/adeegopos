'use client'

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, Calendar, ExternalLink } from 'lucide-react'

import useWsinfoStore from '@/stores/wsinfo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function TransactionList({ transactions, type }) {
  return (
    <div className="space-y-4">
      {transactions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {type} transactions found
        </p>
      ) : (
        transactions.map((transaction) => {
          const isCustomer = transaction.source === 'customer' || transaction.destination === 'customer'
          const counterparty = isCustomer
            ? (transaction.customerName || transaction.from || transaction.to)
            : (transaction.supplierName || transaction.from || transaction.to)

          return (
            <div key={transaction._id} className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                {isCustomer ? (
                  <div className="rounded-full bg-green-100 p-2">
                    <ArrowDownLeft className="h-4 w-4 text-green-600" />
                  </div>
                ) : (
                  <div className="rounded-full bg-red-100 p-2">
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{counterparty || 'Unknown'}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(transaction.createdAt).toLocaleDateString()} at{' '}
                    {new Date(transaction.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{transaction.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold">KES {Number(transaction.amount || 0).toFixed(2)}</p>
                  <div className="mt-1 flex justify-end gap-2">
                    <Badge variant="outline">{transaction.transType}</Badge>
                    <Badge variant={transaction.status === 'reversed' ? 'destructive' : transaction.status === 'replaced' ? 'secondary' : 'default'}>
                      {transaction.status || 'posted'}
                    </Badge>
                  </div>
                </div>
                <Link href={`/finance/transaction/${transaction._id}`}>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [storeNo, setStoreNo] = useState('')
  const store = useWsinfoStore((state) => state.wsinfo)

  useEffect(() => {
    if (store?.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (storeNo) {
      fetchTransactions()
    }
  }, [storeNo])

  const fetchTransactions = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllTransactions', storeNo)
      if (result.success) {
        setTransactions(result.transactions || result.data || [])
      } else {
        console.error('Failed to fetch transactions:', result.error)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const customerPayments = useMemo(
    () => transactions.filter((transaction) => transaction.source === 'customer' || transaction.destination === 'customer'),
    [transactions]
  )
  const supplierPayments = useMemo(
    () => transactions.filter((transaction) => transaction.destination === 'supplier' || transaction.source === 'supplier'),
    [transactions]
  )

  const includedInTotals = (transaction) => transaction.status !== 'reversed' && !transaction.reversalOfId
  const totalCustomerPayments = customerPayments.filter(includedInTotals).reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
  const totalSupplierPayments = supplierPayments.filter(includedInTotals).reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          View customer and supplier payment transactions with reconciliation status.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
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
