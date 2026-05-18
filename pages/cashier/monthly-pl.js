'use client'

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Calendar, DollarSign, Receipt, RefreshCw, TrendingDown, TrendingUp, WalletCards } from "lucide-react"
import useWsinfoStore from "@/stores/wsinfo"

const emptyReport = {
  sales: {
    cashSales: 0,
    mpesaSales: 0,
    creditSales: 0,
    totalSales: 0,
  },
  cogs: 0,
  grossProfit: 0,
  expenses: {
    byType: [],
    totalExpenses: 0,
  },
  netProfit: 0,
}

function padMonth(value) {
  return String(value).padStart(2, "0")
}

function getCurrentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${padMonth(now.getMonth() + 1)}`
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  return {
    fromDate: `${year}-${padMonth(month)}-01`,
    toDate: `${year}-${padMonth(month)}-${padMonth(lastDay)}`,
  }
}

function formatCurrency(value) {
  return `KES ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPercent(value, total) {
  const amount = Number(value || 0)
  const base = Number(total || 0)

  if (!base) {
    return "0%"
  }

  return `${((amount / base) * 100).toFixed(1)}%`
}

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function MetricCard({ title, value, description, icon, valueClassName = "" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function MonthlyProfitLoss() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue())
  const [report, setReport] = useState(emptyReport)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo)
  const { toast } = useToast()

  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth])
  const revenue = report.sales?.totalSales || 0
  const expenses = report.expenses?.byType || []
  const isProfit = Number(report.netProfit || 0) >= 0

  const fetchReport = useCallback(async () => {
    if (!storeNo) return

    setLoading(true)
    setError("")

    try {
      const result = await window.electronAPI.realmOperation("getMonthlyProfitLoss", {
        storeNo,
        fromDate: monthRange.fromDate,
        toDate: monthRange.toDate,
      })

      if (result.success) {
        setReport(result.data || emptyReport)
      } else {
        setReport(emptyReport)
        setError(result.error || "Failed to fetch monthly P&L")
        toast({
          title: "Error",
          description: result.error || "Failed to fetch monthly P&L",
          variant: "destructive",
        })
      }
    } catch (fetchError) {
      console.error("Error fetching monthly P&L:", fetchError)
      setReport(emptyReport)
      setError(fetchError.message || "An error occurred while fetching monthly P&L")
      toast({
        title: "Error",
        description: "An error occurred while fetching monthly P&L",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [monthRange.fromDate, monthRange.toDate, storeNo, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monthly P&L</h1>
          <p className="text-sm text-muted-foreground">
            Profit and loss summary for {formatMonthLabel(selectedMonth)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonthValue())}
              className="w-[180px]"
            />
          </div>
          <Button variant="outline" onClick={fetchReport} disabled={loading || !storeNo}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Revenue"
          value={formatCurrency(revenue)}
          description="Total sales for the month"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="COGS"
          value={formatCurrency(report.cogs)}
          description={formatPercent(report.cogs, revenue) + " of revenue"}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Gross Profit"
          value={formatCurrency(report.grossProfit)}
          description={formatPercent(report.grossProfit, revenue) + " gross margin"}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Expenses"
          value={formatCurrency(report.expenses?.totalExpenses)}
          description={formatPercent(report.expenses?.totalExpenses, revenue) + " of revenue"}
          icon={<WalletCards className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title={isProfit ? "Net Profit" : "Net Loss"}
          value={formatCurrency(report.netProfit)}
          description={formatPercent(report.netProfit, revenue) + " net margin"}
          icon={isProfit ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
          valueClassName={isProfit ? "text-green-700" : "text-destructive"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Profit & Loss Breakdown</CardTitle>
              <CardDescription>
                Revenue, COGS, expenses, and net result for the selected month
              </CardDescription>
            </div>
            <Badge variant={isProfit ? "secondary" : "destructive"}>
              {isProfit ? "Profit" : "Loss"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading monthly P&L...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">% of Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Revenue</TableCell>
                  <TableCell className="text-right">{formatCurrency(revenue)}</TableCell>
                  <TableCell className="text-right">{formatPercent(revenue, revenue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Cash Sales</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.sales?.cashSales)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.sales?.cashSales, revenue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>M-Pesa Sales</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.sales?.mpesaSales)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.sales?.mpesaSales, revenue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Credit Sales</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.sales?.creditSales)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.sales?.creditSales, revenue)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Cost of Goods Sold</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.cogs)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.cogs, revenue)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Gross Profit</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.grossProfit)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.grossProfit, revenue)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Operating Expenses</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.expenses?.totalExpenses)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.expenses?.totalExpenses, revenue)}</TableCell>
                </TableRow>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                      No expenses recorded for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.expenseType}>
                      <TableCell>{expense.expenseType}</TableCell>
                      <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell className="text-right">{formatPercent(expense.amount, revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted font-bold">
                  <TableCell>{isProfit ? "Net Profit" : "Net Loss"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.netProfit)}</TableCell>
                  <TableCell className="text-right">{formatPercent(report.netProfit, revenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
