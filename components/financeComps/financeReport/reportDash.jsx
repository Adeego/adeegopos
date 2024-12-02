import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format, subDays } from 'date-fns'
import React, { useEffect, useState } from 'react'
import ReportCard from './reportCard'
import IncomeStatement from './incomeStatement'
import StatementOfAccount from './statementOfAccount'
import BalanceSheet from './balanceSheet'
import { Banknote, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ReportDash() {
  const [fromDate, setFromDate] = useState(subDays(new Date(), 30))
  const [toDate, setToDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState("from")
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)
  const [statementData, setStatementData] = useState(null)
  const [accountStatements, setAccountStatements] = useState(null)
  const [totalStatement, setTotalStatement] = useState(null)
  const [balanceSheet, setBalanceSheet] = useState(null)
  const [bsAssests, setBsAssets] = useState('')

  useEffect(() => {
    fetchStatement();
    fetchTransactions();
    fetchBalanceSheet();
  }, [fromDate, toDate])

  const handleGenerateReport = () => {
    fetchStatement();
    fetchTransactions();
    fetchBalanceSheet();
  }

  const fetchStatement = async () => {
    try {
      const result = await window.electronAPI.realmOperation('incomeStatement', fromDate, toDate)
      if (result.success) {
        setStatementData(result.data)
      } else {
        setStatementData(null);
        console.error('Failed to fetch income statement:', result.error);
      }
    } catch (error) {
      console.error("Error fetching income statement", error)
    }
  }

  const fetchTransactions = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAccountStatement', fromDate, toDate);
      if (result.success) {
        setAccountStatements(result.transactions);
        setTotalStatement(result.totalAmount)
      } else {
        console.error('Failed to fetch transactions:', result.error);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchBalanceSheet = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getBalanceSheet', fromDate, toDate);
      if (result.success) {
        setBalanceSheet(result.data);
        setBsAssets(result.data.assets.totalAssets)
      } else {
        console.error('Failed to fetch balance sheet:', result.error);
      }
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
    }
  }

  // const handleFromDateSelect = (date) => {
  //   setFromDate(date)
  //   setFromOpen(false)
  // }

  // const handleToDateSelect = (date) => {
  //   setToDate(date)
  //   setToOpen(false)
  // }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Financial Report</CardTitle>
            <CardDescription>You can track your Financial here</CardDescription>
            <div className="flex space-x-4 items-center">
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
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3" >
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-center border-b border-gray-200 bg-gray-50 p-4">
                <CardTitle className="text-xl font-semibold text-gray-500">Income statement</CardTitle>
                <IncomeStatement statementData={statementData} />
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="rounded-full bg-gray-100 p-2"><Banknote /></span>
                    <span className="text-2xl font-bold">
                      KES {statementData?.sales?.totalSales ? statementData.sales.totalSales.toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Total Sales for the Selected Period</p>
              </CardContent>
            </Card>
            <ReportCard
                title={"Chart of Accounts"}
                value={"KES 3800000"}
                icon={<Banknote />}
                description={"This is the chart of Accounts of the store"}
            />
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-center border-b border-gray-200 bg-gray-50 p-4">
                <CardTitle className="text-xl font-semibold text-gray-500">Statement of Accounts</CardTitle>
                <StatementOfAccount statements={accountStatements} />
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="rounded-full bg-gray-100 p-2"><Banknote /></span>
                    <span className="text-2xl font-bold">{totalStatement}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">This is the Statement of Accounts of the store</p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-center border-b border-gray-200 bg-gray-50 p-4">
                <CardTitle className="text-xl font-semibold text-gray-500">Balance Sheet Summary</CardTitle>
                <BalanceSheet balanceSheetData={balanceSheet} />
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="rounded-full bg-gray-100 p-2"><Banknote /></span>
                    <span className="text-2xl font-bold">{bsAssests}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">This is the Statement of Accounts of the store</p>
              </CardContent>
            </Card>
            <ReportCard
                title={"Trial Balance"}
                value={"KES 0"}
                icon={<Banknote />}
                description={"This is the Trial Balance of the store"}
            />
        </CardContent>
    </Card>
  )
}
