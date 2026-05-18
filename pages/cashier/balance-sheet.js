'use client'

import React, { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Calendar, Landmark, RefreshCw, Scale, WalletCards } from "lucide-react"
import useWsinfoStore from "@/stores/wsinfo"

const emptyBalanceSheet = {
  assets: {
    cashAndBankBalances: 0,
    accountsReceivable: 0,
    inventory: 0,
    prepaidExpenses: 0,
    otherCurrentAssets: 0,
    fixedAssets: 0,
    totalCurrentAssets: 0,
    totalAssets: 0,
  },
  liabilities: {
    accountsPayable: 0,
    shortTermLoans: 0,
    otherCurrentLiabilities: 0,
    longTermLoans: 0,
    totalCurrentLiabilities: 0,
    totalLiabilities: 0,
  },
  equity: {
    ownerCapital: 0,
    retainedEarnings: 0,
    totalEquity: 0,
  },
}

function getTodayValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)

  return localDate.toISOString().slice(0, 10)
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

function formatDateLabel(dateValue) {
  return new Date(dateValue).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function normalizeBalanceSheet(data) {
  return {
    assets: {
      ...emptyBalanceSheet.assets,
      ...(data?.assets || {}),
    },
    liabilities: {
      ...emptyBalanceSheet.liabilities,
      ...(data?.liabilities || {}),
    },
    equity: {
      ...emptyBalanceSheet.equity,
      ...(data?.equity || {}),
    },
  }
}

function MetricCard({ title, value, description, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function SectionRow({ children }) {
  return (
    <TableRow className="bg-muted font-medium">
      <TableCell>{children}</TableCell>
      <TableCell className="text-right" />
      <TableCell className="text-right" />
    </TableRow>
  )
}

function DataRow({ label, amount, totalAssets, className = "" }) {
  return (
    <TableRow className={className}>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
      <TableCell className="text-right">{formatPercent(amount, totalAssets)}</TableCell>
    </TableRow>
  )
}

export default function CashierBalanceSheet() {
  const [asOfDate, setAsOfDate] = useState(getTodayValue())
  const [balanceSheet, setBalanceSheet] = useState(emptyBalanceSheet)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo)
  const { toast } = useToast()

  const fetchBalanceSheet = useCallback(async () => {
    if (!storeNo) return

    setLoading(true)
    setError("")

    try {
      const result = await window.electronAPI.realmOperation("getBalanceSheet", asOfDate, storeNo)

      if (result.success) {
        setBalanceSheet(normalizeBalanceSheet(result.data))
      } else {
        setBalanceSheet(emptyBalanceSheet)
        setError(result.error || "Failed to fetch balance sheet")
        toast({
          title: "Error",
          description: result.error || "Failed to fetch balance sheet",
          variant: "destructive",
        })
      }
    } catch (fetchError) {
      console.error("Error fetching balance sheet:", fetchError)
      setBalanceSheet(emptyBalanceSheet)
      setError(fetchError.message || "An error occurred while fetching balance sheet")
      toast({
        title: "Error",
        description: "An error occurred while fetching balance sheet",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [asOfDate, storeNo, toast])

  useEffect(() => {
    fetchBalanceSheet()
  }, [fetchBalanceSheet])

  const { assets, liabilities, equity } = balanceSheet
  const totalAssets = Number(assets.totalAssets || 0)
  const totalLiabilities = Number(liabilities.totalLiabilities || 0)
  const totalEquity = Number(equity.totalEquity || 0)
  const netAssets = totalAssets - totalLiabilities
  const liabilitiesAndEquity = totalLiabilities + totalEquity

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">
            Financial position as of {formatDateLabel(asOfDate)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value || getTodayValue())}
              className="w-[180px]"
            />
          </div>
          <Button variant="outline" onClick={fetchBalanceSheet} disabled={loading || !storeNo}>
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

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Assets"
          value={formatCurrency(totalAssets)}
          description="Cash, receivables, inventory, and fixed assets"
          icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Liabilities"
          value={formatCurrency(totalLiabilities)}
          description={formatPercent(totalLiabilities, totalAssets) + " of total assets"}
          icon={<WalletCards className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Equity"
          value={formatCurrency(totalEquity)}
          description={formatPercent(totalEquity, totalAssets) + " of total assets"}
          icon={<Scale className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Net Assets"
          value={formatCurrency(netAssets)}
          description="Total assets less total liabilities"
          icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet Breakdown</CardTitle>
          <CardDescription>
            Assets, liabilities, and equity as of the selected date
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading balance sheet...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">% of Assets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SectionRow>Assets</SectionRow>
                <SectionRow>Current Assets</SectionRow>
                <DataRow label="Cash and Bank Balances" amount={assets.cashAndBankBalances} totalAssets={totalAssets} />
                <DataRow label="Accounts Receivable" amount={assets.accountsReceivable} totalAssets={totalAssets} />
                <DataRow label="Inventory" amount={assets.inventory} totalAssets={totalAssets} />
                <DataRow label="Prepaid Expenses" amount={assets.prepaidExpenses} totalAssets={totalAssets} />
                <DataRow label="Other Current Assets" amount={assets.otherCurrentAssets} totalAssets={totalAssets} />
                <DataRow label="Total Current Assets" amount={assets.totalCurrentAssets} totalAssets={totalAssets} className="bg-muted font-medium" />
                <SectionRow>Non-Current Assets</SectionRow>
                <DataRow label="Property & Equipment" amount={assets.fixedAssets} totalAssets={totalAssets} />
                <DataRow label="Total Assets" amount={totalAssets} totalAssets={totalAssets} className="bg-muted font-bold" />
                <TableRow>
                  <TableCell colSpan={3} className="h-4" />
                </TableRow>
                <SectionRow>Liabilities</SectionRow>
                <SectionRow>Current Liabilities</SectionRow>
                <DataRow label="Accounts Payable" amount={liabilities.accountsPayable} totalAssets={totalAssets} />
                <DataRow label="Short-Term Loans" amount={liabilities.shortTermLoans} totalAssets={totalAssets} />
                <DataRow label="Other Current Liabilities" amount={liabilities.otherCurrentLiabilities} totalAssets={totalAssets} />
                <DataRow label="Total Current Liabilities" amount={liabilities.totalCurrentLiabilities} totalAssets={totalAssets} className="bg-muted font-medium" />
                <DataRow label="Long-Term Loans" amount={liabilities.longTermLoans} totalAssets={totalAssets} />
                <DataRow label="Total Liabilities" amount={totalLiabilities} totalAssets={totalAssets} className="bg-muted font-bold" />
                <TableRow>
                  <TableCell colSpan={3} className="h-4" />
                </TableRow>
                <SectionRow>Equity</SectionRow>
                <DataRow label="Owner Capital" amount={equity.ownerCapital} totalAssets={totalAssets} />
                <DataRow label="Retained Earnings" amount={equity.retainedEarnings} totalAssets={totalAssets} />
                <DataRow label="Total Equity" amount={totalEquity} totalAssets={totalAssets} className="bg-muted font-bold" />
                <DataRow label="Total Liabilities & Equity" amount={liabilitiesAndEquity} totalAssets={totalAssets} className="bg-muted font-bold" />
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
