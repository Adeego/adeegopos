import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from 'next/link'
import { CalendarIcon, CreditCardIcon, EyeIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ManageCredit() {
  const [sales, setSales] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortColumn, setSortColumn] = useState('createdAt')
  const [sortDirection, setSortDirection] = useState('desc')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchTodayCreditSales(),
      fetchTodayCustomerTransactions()
    ]).finally(() => setLoading(false))
  }, [])

  const fetchTodayCreditSales = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodayCreditSales');
      if (result.success) {
        setSales(result.sales)
        console.log('Today\'s Sales (Excluding Credit):', result.sales);
      } else {
        console.error('Failed to fetch today\'s sales:', result.error);
        setError(result.error)
      }
    } catch (error) {
      console.error('Error fetching today\'s sales:', error);
      setError(error.message)
    }
  }

  const fetchTodayCustomerTransactions = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodayCustomerTransactions');
      if (result.success) {
        setTransactions(result.transactions)
        console.log('Today\'s Customer Transactions:', result.transactions);
      } else {
        console.error('Failed to fetch today\'s transactions:', result.error);
        setError(result.error)
      }
    } catch (error) {
      console.error('Error fetching today\'s transactions:', error);
      setError(error.message)
    }
  }

  const sortedSales = [...sales].sort((a, b) => {
    if (a[sortColumn] < b[sortColumn]) return sortDirection === 'asc' ? -1 : 1
    if (a[sortColumn] > b[sortColumn]) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (column) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="p-4">
      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="sales">Credit Sales</TabsTrigger>
          <TabsTrigger value="transactions">Customer Transactions (Credits repaid)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales">
          <section className="space-y-6">
            {sales.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Credit Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => handleSort('createdAt')}>
                          Date {sortColumn === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort('totalAmount')}>
                          Total Amount {sortColumn === 'totalAmount' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort('paymentMethod')}>
                          Payment Method {sortColumn === 'paymentMethod' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSales.map((sale) => (
                        <TableRow key={sale._id}>
                          <TableCell>
                            <div className="flex items-center">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {new Date(sale.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            KES {sale.totalAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <CreditCardIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {sale.paymentMethod}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm">
                              <Link href={`/pos/${sale._id}`}>
                                <EyeIcon className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <div className="text-4xl font-bold text-muted-foreground mb-4">No sales yet</div>
                  <p className="text-muted-foreground mb-4">Your sales will appear here once you start making transactions.</p>
                  <Button asChild>
                    <Link href="/">Go to POS</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>
        </TabsContent>
        
        <TabsContent value="transactions">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead >
                        Customer 
                      </TableHead>
                      <TableHead >
                        Date
                      </TableHead>
                      <TableHead >
                        Amount
                      </TableHead>
                      <TableHead >
                        Description
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => (
                      <TableRow key={index} className="transition-colors hover:bg-muted/50">
                        <TableCell className="font-medium">{transaction.customerDetails.name}</TableCell>
                        <TableCell>{new Date(transaction.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                        <TableCell>{new Intl.NumberFormat("en-US", { style: "currency", currency: "KES" }).format(transaction.amount)}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-[150px] items-center justify-center text-muted-foreground">
                  No transactions found.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
