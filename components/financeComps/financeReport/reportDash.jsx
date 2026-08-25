import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Database, Download, Printer, RefreshCw, Scale } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import useWsinfoStore from '@/stores/wsinfo'

function todayValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function daysAgoValue(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function formatCurrency(value) {
  return `KES ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
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

export default function ReportDash() {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo)
  const { toast } = useToast()
  const [fromDate, setFromDate] = useState(daysAgoValue(30))
  const [toDate, setToDate] = useState(todayValue())
  const [loading, setLoading] = useState(false)
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [income, setIncome] = useState(null)
  const [balanceSheet, setBalanceSheet] = useState(null)
  const [trialBalance, setTrialBalance] = useState(null)
  const [ledgerRows, setLedgerRows] = useState([])
  const [health, setHealth] = useState(null)
  const [preview, setPreview] = useState(null)

  const fetchReports = useCallback(async () => {
    if (!storeNo) return
    setLoading(true)
    try {
      const [incomeResult, balanceResult, trialResult, ledgerResult, healthResult] = await Promise.all([
        window.electronAPI.realmOperation('incomeStatement', fromDate, toDate, storeNo),
        window.electronAPI.realmOperation('getBalanceSheet', toDate, storeNo),
        window.electronAPI.realmOperation('getTrialBalance', fromDate, toDate, storeNo),
        window.electronAPI.realmOperation('getGeneralLedger', { storeNo, fromDate, toDate }),
        window.electronAPI.realmOperation('getFinanceLedgerHealth', { storeNo }),
      ])

      if (!incomeResult.success) throw new Error(incomeResult.error || 'Failed to load income statement')
      if (!balanceResult.success) throw new Error(balanceResult.error || 'Failed to load balance sheet')
      if (!trialResult.success) throw new Error(trialResult.error || 'Failed to load trial balance')
      if (!ledgerResult.success) throw new Error(ledgerResult.error || 'Failed to load general ledger')
      if (!healthResult.success) throw new Error(healthResult.error || 'Failed to load ledger health')

      setIncome(incomeResult.data)
      setBalanceSheet(balanceResult.data)
      setTrialBalance(trialResult.data)
      setLedgerRows(ledgerResult.rows || ledgerResult.data || [])
      setHealth(healthResult.health)
    } catch (error) {
      toast({
        title: 'Finance report failed',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [fromDate, storeNo, toDate, toast])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const previewBackfill = async () => {
    if (!storeNo) return
    setBackfillLoading(true)
    try {
      const result = await window.electronAPI.realmOperation('previewFinanceLedgerBackfill', { storeNo })
      if (!result.success) throw new Error(result.error || 'Backfill preview failed')
      setPreview(result.preview)
    } catch (error) {
      toast({ title: 'Backfill preview failed', description: error.message, variant: 'destructive' })
    } finally {
      setBackfillLoading(false)
    }
  }

  const runBackfill = async () => {
    if (!storeNo) return
    setBackfillLoading(true)
    try {
      const result = await window.electronAPI.realmOperation('runFinanceLedgerBackfill', { storeNo })
      if (!result.success) throw new Error(result.error || 'Backfill failed')
      toast({
        title: 'Ledger backfill complete',
        description: `${result.result?.createdJournalEntries || 0} journal entries created.`,
      })
      setPreview(null)
      await fetchReports()
    } catch (error) {
      toast({ title: 'Backfill failed', description: error.message, variant: 'destructive' })
    } finally {
      setBackfillLoading(false)
    }
  }

  const exportLedger = () => {
    downloadCsv(`general-ledger-${storeNo}-${fromDate}-${toDate}.csv`, [
      ['Date', 'Account Code', 'Account', 'Description', 'Debit', 'Credit', 'Source Type', 'Source ID'],
      ...ledgerRows.map((row) => [
        row.date,
        row.accountCode,
        row.accountName,
        row.description,
        row.debit,
        row.credit,
        row.sourceDocType,
        row.sourceDocId,
      ]),
    ])
  }

  const trialDifference = useMemo(() => {
    return Number(trialBalance?.totalDebits || 0) - Number(trialBalance?.totalCredits || 0)
  }, [trialBalance])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>Accrual reports powered by balanced journal entries.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="w-[160px]" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="w-[160px]" />
              <Button variant="outline" onClick={fetchReports} disabled={loading || !storeNo}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportLedger} disabled={ledgerRows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Revenue" value={formatCurrency(income?.sales?.totalSales)} description="Accrual sales revenue" icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
        <MetricCard title="Gross Profit" value={formatCurrency(income?.grossProfit)} description="Revenue less COGS" icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
        <MetricCard title="Net Profit" value={formatCurrency(income?.netProfit)} description="After operating expenses" icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
        <MetricCard title="Total Assets" value={formatCurrency(balanceSheet?.assets?.totalAssets)} description="As of selected end date" icon={<Database className="h-4 w-4 text-muted-foreground" />} />
        <MetricCard title="Trial Difference" value={formatCurrency(trialDifference)} description="Debits minus credits" icon={<Scale className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Ledger Health & Backfill</CardTitle>
              <CardDescription>Review missing historical journal entries before writing them.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={health?.isHealthy ? 'secondary' : 'destructive'}>
                {health?.isHealthy ? 'Healthy' : 'Needs Review'}
              </Badge>
              <Button variant="outline" onClick={previewBackfill} disabled={backfillLoading || !storeNo}>
                Preview Backfill
              </Button>
              <Button onClick={runBackfill} disabled={backfillLoading || !preview || preview.missingJournalEntries === 0}>
                Run Backfill
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Journal Entries</div>
              <div className="text-xl font-bold">{health?.journalEntries || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Missing</div>
              <div className="text-xl font-bold">{health?.missingJournalEntries || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unbalanced</div>
              <div className="text-xl font-bold">{health?.unbalancedJournalEntries || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Warnings</div>
              <div className="text-xl font-bold">{health?.warnings?.length || preview?.warnings?.length || 0}</div>
            </div>
          </div>
          {preview && (
            <div className="mt-4 rounded-md border p-3 text-sm">
              Backfill preview found <strong>{preview.missingJournalEntries}</strong> missing journal entries across{' '}
              <strong>{preview.totalSourceEntries}</strong> source records.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income Statement</CardTitle>
            <CardDescription>Revenue, COGS, and expenses for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <ReportRow label="Cash Sales" value={income?.sales?.cashSales} />
                <ReportRow label="M-Pesa Sales" value={income?.sales?.mpesaSales} />
                <ReportRow label="Credit Sales" value={income?.sales?.creditSales} />
                <ReportRow label="Total Revenue" value={income?.sales?.totalSales} strong />
                <ReportRow label="COGS" value={income?.cogs} />
                <ReportRow label="Gross Profit" value={income?.grossProfit} strong />
                <ReportRow label="Operating Expenses" value={income?.expenses?.totalExpenses} />
                <ReportRow label="Net Profit" value={income?.netProfit} strong />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>Assets, liabilities, and equity as of the selected end date.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <ReportRow label="Cash and Bank" value={balanceSheet?.assets?.cashAndBankBalances} />
                <ReportRow label="Accounts Receivable" value={balanceSheet?.assets?.accountsReceivable} />
                <ReportRow label="Inventory" value={balanceSheet?.assets?.inventory} />
                <ReportRow label="Total Assets" value={balanceSheet?.assets?.totalAssets} strong />
                <ReportRow label="Accounts Payable" value={balanceSheet?.liabilities?.accountsPayable} />
                <ReportRow label="Total Liabilities" value={balanceSheet?.liabilities?.totalLiabilities} strong />
                <ReportRow label="Total Equity" value={balanceSheet?.equity?.totalEquity} strong />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Ledger</CardTitle>
          <CardDescription>Journal lines for the selected reporting period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[460px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No journal lines found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerRows.slice(0, 200).map((row, index) => (
                    <TableRow key={`${row.journalEntryId}-${row.accountCode}-${index}`}>
                      <TableCell>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{row.accountCode} · {row.accountName}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : '-'}</TableCell>
                      <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : '-'}</TableCell>
                      <TableCell>{row.sourceDocType}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReportRow({ label, value, strong = false }) {
  return (
    <TableRow className={strong ? 'bg-muted font-medium' : ''}>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right">{formatCurrency(value)}</TableCell>
    </TableRow>
  )
}
