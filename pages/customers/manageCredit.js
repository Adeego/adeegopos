import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ManageCredit() {
  const [sales, setSales] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
          <section>
            {sales.length > 0 ? (
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Total Amount</th>
                    <th className="border p-2">Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="border p-2">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="border p-2">{sale.totalAmount}</td>
                      <td className="border p-2">{sale.paymentMethod}</td>
                      <td className="border p-2"><Button ><Link href={`/pos/${sale._id}`} passHref >View</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No sales found.</p>
            )}
          </section>
        </TabsContent>
        
        <TabsContent value="transactions">
          <section>
            {transactions.length > 0 ? (
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Amount</th>
                    <th className="border p-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="border p-2">{new Date(transaction.createdAt).toLocaleString()}</td>
                      <td className="border p-2">{transaction.amount}</td>
                      <td className="border p-2">{transaction.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No transactions found.</p>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
