'use client'

import React, { useState, useEffect } from "react"
import MetricCard from "@/components/dashboardComps/metricCard"
import SalesLineChart from "@/components/dashboardComps/lineChart"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Cable, CreditCard, DollarSign, Landmark, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react'


export default function Dashboard() {
  const [salesData, setSalesData] = useState([])
  const [expense, setExpense] = useState([])
  const [transaction, setTransaction] = useState([])
  const [cashflow, setCashflow] = useState(0)

  useEffect(() => {
    fetchSalesData();
    fetchExpenseData();
    transactionMetrics();
  }, [])

  useEffect(() => {
    const grossCashflow = (salesData.revenue + transaction.customerCredits) - (expense + salesData.customerCredit + transaction.supplierPayments);
    setCashflow(grossCashflow);
  }, [salesData, expense, transaction])

  const fetchSalesData = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodaysSalesMetrics');
      if (result.success) {
        setSalesData(result.data);
      } else {
        console.error('Failed to fetch Sales Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Sales Data:', error);
    }
  };

  const transactionMetrics = async () => {
    try {
      const result = await window.electronAPI.realmOperation('transactionMetrics');
      console.log(result)
      if (result.success) {
        setTransaction(result.data);
      } else {
        console.error('Failed to fetch Transaction Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Transaction Data:', error);
    }
  };

  const fetchExpenseData = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodaysExpenses');
      if (result.success) {
        setExpense(result.data.totalExpenses);
      } else {
        console.error('Failed to fetch Expense Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Expense Data:', error);
    }
  };

  return (
    <div className="">
      <h1 className="text-2xl font-bold">Today's Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        {new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </p>
      <div className="">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Today's Sales</CardTitle>
            <CardDescription>Performance of the store</CardDescription>
            {/* Add the AI analyzer here */}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                title="Total Sales"
                value={`KES ${salesData.revenue}`}
                icon={<DollarSign className="h-4 w-4" />}
                change={5}
                trend="up"
                color="green"
              />
              <MetricCard
                title="Number of Sales"
                value={salesData.numberOfSales}
                icon={<ShoppingCart className="h-4 w-4" />}
                change={15}
                trend="up"
                color="green"
              />
              <MetricCard
                title="Gross Profit"
                value={`KES ${salesData.profit}`}
                icon={<TrendingUp className="h-4 w-4" />}
                change={2}
                trend="down"
                color="red"
              />
              <MetricCard
                title="Expense"
                value={`KES ${expense}`}
                icon={<Landmark className="h-4 w-4" />}
                change={7}
                trend="down"
                color="green"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full mt-4">
          <CardContent className="">
            <div className="grid gap-4 md:grid-cols-4 mt-6">
              <MetricCard
                title="Credits Given"
                value={`KES ${salesData.customerCredit}`}
                icon={<CreditCard className="h-4 w-4" />}
                change={1}
                trend="up"
                color="red"
              />
              <MetricCard
                title="Credits Paid"
                value={`KES ${transaction.customerCredits}`}
                icon={<WalletCards className="h-4 w-4" />}
                change={5}
                trend="up"
                color="green"
              />
              <MetricCard
                title="Suppliers Paid"
                value={`KES ${transaction.supplierPayments}`}
                icon={<Cable className="h-4 w-4" />}
                change={8}
                trend="down"
                color="green"
              />
              <MetricCard
                title="Cashflow"
                value={`KES ${cashflow}`}
                icon={<DollarSign className="h-4 w-4" />}
                change={12}
                trend="up"
                color="green"
              />
            </div>
          </CardContent>
        </Card>

        <SalesLineChart />

      </div>
    </div>
  )
}