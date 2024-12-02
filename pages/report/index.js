import React, { useState, useEffect } from 'react'
import MetricCard from '@/components/reportComps/metricsCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Cable, CreditCard, DollarSign, Landmark, ShoppingCart, Store, TrendingUp, WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SalesHistory from '../pos/salesHistory'
import Link from 'next/link'

export default function Report() {
  const [salesData, setSalesData] = useState([])
  const [expense, setExpense] = useState([])
  const [transaction, setTransaction] = useState([])
  const [cashflow, setCashflow] = useState(0)
  const [yesterdaySalesData, setYesterdaySalesData] = useState([])
  const [yesterdayExpense, setYesterdayExpense] = useState([])
  const [yesterdayTransaction, setYesterdayTransaction] = useState([])
  const [yesterdayCashflow, setYesterdayCashflow] = useState(0)
  const [activeTab, setActiveTab] = useState("from")
  
  // New state for date range selection
  const [fromDate, setFromDate] = useState(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo;
  });
  const [toDate, setToDate] = useState(new Date())

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

  const handleGenerateReport = () => {
    fetchSalesData();
    fetchExpenseData();
    transactionMetrics();
  }

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
      const result = await window.electronAPI.realmOperation('getSalesMetricsReport', fromDate.toISOString(), toDate.toISOString() );
      if (result.success) {
        setSalesData(result.data.currentPeriod);
        setYesterdaySalesData(result.data.previousPeriod);
      } else {
        console.error('Failed to fetch Sales Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Sales Data:', error);
    }
  };

  const transactionMetrics = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTransactionMetricsReport', fromDate.toISOString(), toDate.toISOString());
      console.log(result)
      if (result.success) {
        setTransaction(result.data.currentPeriod);
        setYesterdayTransaction(result.data.previousPeriod);
      } else {
        console.error('Failed to fetch Transaction Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Transaction Data:', error);
    }
  };

  const fetchExpenseData = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getExpensesReport', fromDate.toISOString(), toDate.toISOString());
      if (result.success) {
        setExpense(result.data.currentPeriod.totalExpenses);
        setYesterdayExpense(result.data.previousPeriod.totalExpenses);
      } else {
        console.error('Failed to fetch Expense Data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching Expense Data:', error);
    }
  };

  return (
    <Card >
      <CardHeader >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle >Performance Report</CardTitle>
            <CardDescription >Check how the store has been performing within a specific time</CardDescription>
          </div>
          <div className=" space-x-2">
            <Button >
              <Link href={'/pos/salesHistory'} >Sales History</Link>
            </Button>
            <Dialog >
              <DialogTrigger className="border-2 rounded-md p-2" >
                {fromDate ? format(fromDate, "PPP") : <span>From Date</span>} - {toDate ? format(toDate, "PPP") : <span>To Date</span>}
              </DialogTrigger>
              <DialogContent className="w-[350px]" >
                <DialogHeader >
                  <DialogTitle >Select the dates</DialogTitle>
                  <DialogDescription >Choose the 2 dates you want to generate the report</DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[100%]">
                  <TabsList className="w-[100%] flex justify-around">
                    <TabsTrigger value="from">From Date</TabsTrigger>
                    <TabsTrigger value="to">To Date</TabsTrigger>
                  </TabsList>
                  <TabsContent value="from"> 
                      <Calendar
                        size="sm"
                        mode="single"
                        selected={fromDate}
                        onSelect={(selectedDate) => {
                          setFromDate(selectedDate);
                          setActiveTab("to"); 
                        }}
                        initialFocus
                      />
                  </TabsContent>
                  <TabsContent value="to">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={(selectedDate) => {
                          setToDate(selectedDate);
                          setActiveTab("from");
                        }}
                        initialFocus
                      />
                  </TabsContent>
                </Tabs>
                <DialogFooter className="" >
                  <Button onClick={handleGenerateReport} >Select</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-muted p-4" >
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
      </CardContent>
    </Card>
  )
}
