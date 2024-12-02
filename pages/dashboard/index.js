'use client'

import React, { useState, useEffect } from "react"
import MetricCard from "@/components/dashboardComps/metricCard"
import SalesLineChart from "@/components/dashboardComps/lineChart"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Cable, CreditCard, DollarSign, Landmark, ShoppingCart, Store, TrendingUp, WalletCards } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function Dashboard() {
  const [salesData, setSalesData] = useState([])
  const [expense, setExpense] = useState([])
  const [transaction, setTransaction] = useState([])
  const [cashflow, setCashflow] = useState(0)
  const [yesterdaySalesData, setYesterdaySalesData] = useState([])
  const [yesterdayExpense, setYesterdayExpense] = useState([])
  const [yesterdayTransaction, setYesterdayTransaction] = useState([])
  const [yesterdayCashflow, setYesterdayCashflow] = useState(0)

  useEffect(() => {
    fetchSalesData();
    fetchExpenseData();
    transactionMetrics();
  }, [])

  useEffect(() => {
    const grossCashflow = (salesData.revenue + transaction.customerCredits) - (expense + salesData.customerCredit + transaction.supplierPayments);
    setCashflow(grossCashflow);
    const YesterdayGrossCashflow = (yesterdaySalesData.revenue + yesterdayTransaction.customerCredits) - (yesterdayExpense + yesterdaySalesData.customerCredit + yesterdayTransaction.supplierPayments);
    setYesterdayCashflow(YesterdayGrossCashflow);
  }, [salesData, expense, transaction])

  // Helper function to calculate percentage change
  const calculatePercentageChange = (today, yesterday) => {
    if (yesterday === 0 || yesterday === undefined) return 0;
    return Math.abs(((today - yesterday) / yesterday) * 100).toFixed(1);
  }

  // Helper function to determine trend
  const determineTrend = (today, yesterday) => {
    return today >= yesterday ? 'up' : 'down';
  }

  // Helper function to determine color based on metric and trend
  const determineColor = (metricName, trend) => {
    const positiveMetrics = ['Total Sales', 'Number of Sales', 'Gross Margin', 'Credits Paid', 'Cashflow'];
    const negativeMetrics = ['Expense', 'Credits Given', 'Suppliers Paid'];

    if (positiveMetrics.includes(metricName)) {
      return trend === 'up' ? 'green' : 'red';
    } else if (negativeMetrics.includes(metricName)) {
      return trend === 'down' ? 'green' : 'red';
    }
    return 'gray';
  }

  const fetchSalesData = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTodaysSalesMetrics');
      if (result.success) {
        setSalesData(result.data.today);
        setYesterdaySalesData(result.data.yesterday);
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
        setTransaction(result.data.today);
        setYesterdayTransaction(result.data.yesterday);
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
        setExpense(result.data.today.totalExpenses);
        setYesterdayExpense(result.data.yesterday.totalExpenses);
      } else {
        console.error('Failed to fetch Expense Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Expense Data:', error);
    }
  };

  return (
    <div className="">
      <div className="flex flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Performance of Today</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div>
          {/* <Dialog>
            <DialogTrigger><Button><Store /> <span className="text-base ml-2">Close Store</span></Button></DialogTrigger>
            <DialogContent>
              <DialogTitle>Closing Operations of Today</DialogTitle>
              <DialogDescription>Check and confirm the numbers add up</DialogDescription>
              <Card>
                <CardContent>
                  <div className="my-4">
                    <h1>Opening Cash Balance</h1>
                    <p>KES 25000</p>
                  </div>
                  <div className="my-4">
                    <p>Cash = KES 51000</p>
                    <p>Mpesa  = KES 44000</p>
                    <h1>closing cash balance</h1>
                    <p>KES 95000</p>
                  </div>
                  <div className="my-4">
                    <Label>Tomorrow Opening Cash Balance</Label>
                    <Input type="number" placeholder="The amount of money for tomorrow opening cash balance" />
                  </div>
                  <div className="flex justify-end">
                    <Button >Close Operations</Button>
                  </div>
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog> */}
        </div>
      </div>
      <div className="">
        <Card className="w-full pt-6 mt-4">
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                title="Total Sales"
                value={`KES ${salesData.revenue || 0}`}
                icon={<DollarSign className="h-4 w-4" />}
                change={calculatePercentageChange(salesData.revenue, yesterdaySalesData.revenue)}
                trend={determineTrend(salesData.revenue, yesterdaySalesData.revenue)}
                color={determineColor('Total Sales', determineTrend(salesData.revenue, yesterdaySalesData.revenue))}
              />
              <MetricCard
                title="Number of Sales"
                value={salesData.numberOfSales || 0}
                icon={<ShoppingCart className="h-4 w-4" />}
                change={calculatePercentageChange(salesData.numberOfSales, yesterdaySalesData.numberOfSales)}
                trend={determineTrend(salesData.numberOfSales, yesterdaySalesData.numberOfSales)}
                color={determineColor('Number of Sales', determineTrend(salesData.numberOfSales, yesterdaySalesData.numberOfSales))}
              />
              <MetricCard
                title="Gross Margin"
                value={`KES ${salesData.profit || 0}`}
                icon={<TrendingUp className="h-4 w-4" />}
                change={calculatePercentageChange(salesData.profit, yesterdaySalesData.profit)}
                trend={determineTrend(salesData.profit, yesterdaySalesData.profit)}
                color={determineColor('Gross Margin', determineTrend(salesData.profit, yesterdaySalesData.profit))}
              />
              <MetricCard
                title="Expense"
                value={`KES ${expense || 0}`}
                icon={<Landmark className="h-4 w-4" />}
                change={calculatePercentageChange(expense, yesterdayExpense)}
                trend={determineTrend(expense, yesterdayExpense)}
                color={determineColor('Expense', determineTrend(expense, yesterdayExpense))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full mt-4">
          <CardContent className="">
            <div className="grid gap-4 md:grid-cols-4 mt-6">
              <MetricCard
                title="Credits Given"
                value={`KES ${salesData.customerCredit || 0}`}
                icon={<CreditCard className="h-4 w-4" />}
                change={calculatePercentageChange(salesData.customerCredit, yesterdaySalesData.customerCredit)}
                trend={determineTrend(salesData.customerCredit, yesterdaySalesData.customerCredit)}
                color={determineColor('Credits Given', determineTrend(salesData.customerCredit, yesterdaySalesData.customerCredit))}
              />
              <MetricCard
                title="Credits Paid"
                value={`KES ${transaction.customerCredits || 0}`}
                icon={<WalletCards className="h-4 w-4" />}
                change={calculatePercentageChange(transaction.customerCredits, yesterdayTransaction.customerCredits)}
                trend={determineTrend(transaction.customerCredits, yesterdayTransaction.customerCredits)}
                color={determineColor('Credits Paid', determineTrend(transaction.customerCredits, yesterdayTransaction.customerCredits))}
              />
              <MetricCard
                title="Suppliers Paid"
                value={`KES ${transaction.supplierPayments || 0}`}
                icon={<Cable className="h-4 w-4" />}
                change={calculatePercentageChange(transaction.supplierPayments, yesterdayTransaction.supplierPayments)}
                trend={determineTrend(transaction.supplierPayments, yesterdayTransaction.supplierPayments)}
                color={determineColor('Suppliers Paid', determineTrend(transaction.supplierPayments, yesterdayTransaction.supplierPayments))}
              />
              <MetricCard
                title="Cashflow"
                value={`KES ${cashflow || 0}`}
                icon={<DollarSign className="h-4 w-4" />}
                change={calculatePercentageChange(cashflow, yesterdayCashflow)}
                trend={determineTrend(cashflow, yesterdayCashflow)}
                color={determineColor('Cashflow', determineTrend(cashflow, yesterdayCashflow))}
              />
            </div>
          </CardContent>
        </Card>

        <SalesLineChart />
        
      </div>
    </div>
  )
}
