import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, ClipboardCheck, Loader2, Minus, Printer, RotateCcw, ShieldCheck, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { hasModuleLevel, MODULE_IDS } from '@/lib/rbac'
import useStaffStore from '@/stores/staffStore'
import useWsinfoStore from '@/stores/wsinfo'

const money = (amount) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(Number(amount) || 0)
const displayDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const actorName = (actor) => actor?.name || '—'

export default function StockAuditPage() {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo)
  const staff = useStaffStore((state) => state.staff)
  const [activeTab, setActiveTab] = useState('daily')
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Daily Stock Audit</h1>
        <p className="text-neutral-500 mt-1">Count yesterday&apos;s sold items, settle discrepancies, and obtain manager approval.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily" className="gap-2"><ClipboardCheck className="h-4 w-4" />Daily Audit</TabsTrigger>
          <TabsTrigger value="review" className="gap-2"><ShieldCheck className="h-4 w-4" />Manager Review</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><BarChart3 className="h-4 w-4" />History</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4">
          {storeNo && <DailyAuditTab storeNo={storeNo} refreshKey={refreshKey} onChanged={refresh} />}
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          {storeNo && <ReviewTab storeNo={storeNo} staff={staff} refreshKey={refreshKey} onChanged={refresh} />}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {storeNo && <HistoryTab storeNo={storeNo} refreshKey={refreshKey} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DailyAuditTab({ storeNo, refreshKey, onChanged }) {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [search, setSearch] = useState('')
  const [differences, setDifferences] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.realmOperation('getDailyAudit', storeNo)
      if (!result.success) throw new Error(result.error)
      setAudit(result.audit)
      if (result.audit?.status === 'in_progress') hydrateDifferences(result.audit, setDifferences)
    } catch (error) {
      toast({ title: 'Could not load audit', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [storeNo])

  useEffect(() => { load() }, [load, refreshKey])

  const createAndPrint = async () => {
    setBusy('start')
    try {
      const created = await window.electronAPI.realmOperation('createAudit', storeNo)
      if (!created.success) throw new Error(created.error)
      setAudit(created.audit)
      hydrateDifferences(created.audit, setDifferences)
      const printed = await window.electronAPI.realmOperation('printAuditSheets', created.audit._id)
      if (!printed.success) {
        toast({ title: 'Audit saved; printing failed', description: `${printed.error}. Use Reprint sheets to try again.`, variant: 'destructive' })
      } else {
        setAudit(printed.audit || created.audit)
        toast({ title: created.resumed ? 'Audit resumed and printed' : 'Daily audit started', description: printed.warning || 'Both counting sheets were printed.' })
      }
      onChanged()
    } catch (error) {
      toast({ title: 'Could not start audit', description: error.message, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const print = async () => {
    setBusy('print')
    const result = await window.electronAPI.realmOperation('printAuditSheets', audit._id)
    if (result.success) {
      setAudit(result.audit || audit)
      toast({ title: 'Audit sheets printed', description: result.warning })
    } else toast({ title: 'Printing failed', description: result.error, variant: 'destructive' })
    setBusy('')
  }

  const setDifference = (productId, field, value) => {
    setDifferences((current) => ({ ...current, [productId]: { ...(current[productId] || {}), [field]: value } }))
  }

  const toggleDifference = (item, checked) => {
    setDifferences((current) => {
      if (!checked) {
        const next = { ...current }
        delete next[item.productId]
        return next
      }
      return { ...current, [item.productId]: { physicalCount: '', reason: '', resolution: '' } }
    })
  }

  const submit = async () => {
    setBusy('submit')
    try {
      const discrepancies = Object.entries(differences).map(([productId, entry]) => ({ productId, ...entry }))
      const result = await window.electronAPI.realmOperation('submitAudit', audit._id, { discrepancies })
      if (!result.success) throw new Error(result.error)
      setAudit(result.audit)
      toast({ title: 'Submitted for manager approval', description: `${result.audit.summary.discrepancyCount} discrepancies recorded. Stock has not changed yet.` })
      onChanged()
    } catch (error) {
      toast({ title: 'Could not submit audit', description: error.message, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const filteredItems = useMemo(() => (audit?.items || []).filter((item) => item.productName.toLowerCase().includes(search.toLowerCase())), [audit, search])

  if (loading) return <Loading />
  if (!audit) return (
    <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-4">
      <ClipboardCheck className="h-16 w-16 text-neutral-300" />
      <h3 className="text-lg font-semibold">Start yesterday&apos;s stock audit</h3>
      <p className="max-w-lg text-center text-sm text-neutral-500">The app will load products with positive net sales yesterday and print a system-stock sheet plus a blank physical-count sheet.</p>
      <Button onClick={createAndPrint} disabled={!!busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Start and print two sheets
      </Button>
    </CardContent></Card>
  )

  if (audit.status === 'pending_approval') return (
    <div className="space-y-4">
      <AuditHeader audit={audit} onPrint={print} busy={busy} />
      <Card><CardContent className="py-12 text-center space-y-3">
        <ShieldCheck className="h-14 w-14 mx-auto text-amber-500" />
        <h3 className="text-lg font-semibold">Awaiting a separate Inventory Manager</h3>
        <p className="text-sm text-neutral-500">Submitted by {actorName(audit.submittedBy)}. Inventory will change only after approval.</p>
        <AuditItemsTable items={audit.items} />
      </CardContent></Card>
    </div>
  )

  if (audit.status === 'completed') return (
    <div className="space-y-4"><AuditHeader audit={audit} onPrint={print} busy={busy} /><AuditResultCards summary={audit.summary} />
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Approved by {actorName(audit.approvedBy)}</CardTitle></CardHeader><CardContent><AuditItemsTable items={audit.items} /></CardContent></Card>
    </div>
  )

  const lastRejection = [...(audit.reviewHistory || [])].reverse().find((review) => review.action === 'rejected')
  return (
    <div className="space-y-4">
      <AuditHeader audit={audit} onPrint={print} busy={busy} />
      {lastRejection && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Returned by {actorName(lastRejection.actor)}:</strong> {lastRejection.reason}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard label="Sold products" value={audit.items.length} />
        <MiniCard label="Marked differences" value={Object.keys(differences).length} color="text-red-600" />
        <MiniCard label="Sales date" value={audit.auditDate} />
        <MiniCard label="Prints" value={audit.printCount || 0} />
      </div>
      <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Enter differences only</CardTitle><p className="mt-1 text-sm text-neutral-500">Unchecked items will be submitted as matching the app stock.</p></div><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product…" className="max-w-xs" /></div></CardHeader>
        <CardContent>
          {audit.items.length === 0 ? <p className="py-10 text-center text-neutral-500">No products had positive net sales yesterday. Submit the empty audit for review.</p> :
            <div className="space-y-3">{filteredItems.map((item) => {
              const entry = differences[item.productId]
              return <div key={item.productId} className={`rounded-md border p-4 ${entry ? 'border-red-200 bg-red-50/40' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-medium">{item.productName}</p><p className="text-sm text-neutral-500">Sold {item.netSoldQuantity} base units · App stock {item.systemStock}</p></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!entry} onChange={(event) => toggleDifference(item, event.target.checked)} />Has a difference</label>
                </div>
                {entry && <div className="grid gap-3 mt-4 md:grid-cols-3">
                  <Input type="number" min="0" step="0.01" aria-label={`${item.productName} physical count`} placeholder="Actual stock" value={entry.physicalCount} onChange={(event) => setDifference(item.productId, 'physicalCount', event.target.value)} />
                  <Textarea aria-label={`${item.productName} reason`} placeholder="Reason for difference" value={entry.reason} onChange={(event) => setDifference(item.productId, 'reason', event.target.value)} />
                  <Textarea aria-label={`${item.productName} resolution`} placeholder="How it was settled" value={entry.resolution} onChange={(event) => setDifference(item.productId, 'resolution', event.target.value)} />
                </div>}
              </div>
            })}</div>}
          <div className="mt-4 flex justify-end"><Button onClick={submit} disabled={!!busy} className="gap-2">{busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Submit for approval</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}

function hydrateDifferences(audit, setter) {
  const next = {}
  for (const item of audit.items || []) {
    if (Number(item.variance) !== 0 && item.physicalCount != null) next[item.productId] = { physicalCount: item.physicalCount, reason: item.reason || '', resolution: item.resolution || '' }
  }
  setter(next)
}

function AuditHeader({ audit, onPrint, busy }) {
  return <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">Sales date: {audit.auditDate || displayDate(audit.createdAt)}</p><p className="text-sm text-neutral-500">Created by {actorName(audit.createdBy)} · Status: {audit.status.replaceAll('_', ' ')}</p></div><Button variant="outline" onClick={onPrint} disabled={!!busy} className="gap-2">{busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Reprint sheets</Button></CardContent></Card>
}

function ReviewTab({ storeNo, staff, refreshKey, onChanged }) {
  const [audits, setAudits] = useState([])
  const [busy, setBusy] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState({})
  const canApprove = hasModuleLevel(staff, MODULE_IDS.INVENTORY, 'manage')

  const load = useCallback(async () => {
    const result = await window.electronAPI.realmOperation('getOpenAudits', storeNo)
    if (result.success) setAudits((result.audits || []).filter((audit) => audit.status === 'pending_approval'))
    else toast({ title: 'Could not load manager queue', description: result.error, variant: 'destructive' })
  }, [storeNo])
  useEffect(() => { load() }, [load, refreshKey])

  const act = async (operation, audit, reason = '') => {
    setBusy(audit._id)
    const result = await window.electronAPI.realmOperation(operation, audit._id, reason)
    if (result.success) {
      toast({ title: operation === 'approveAudit' ? 'Audit approved' : 'Audit returned for correction', description: operation === 'approveAudit' ? 'Stock corrections were posted.' : 'No stock was changed.' })
      await load(); onChanged()
    } else toast({ title: 'Review failed', description: result.error, variant: 'destructive' })
    setBusy('')
  }

  if (!audits.length) return <Card><CardContent className="py-14 text-center text-neutral-500"><ShieldCheck className="h-12 w-12 mx-auto mb-3 text-neutral-300" />No audits are awaiting approval.</CardContent></Card>
  return <div className="space-y-4">{audits.map((audit) => {
    const ownSubmission = audit.submittedBy?.id === staff?._id
    return <Card key={audit._id}><CardHeader><CardTitle className="flex justify-between gap-3"><span>{audit.auditDate} · {audit.summary?.discrepancyCount || 0} discrepancies</span><Badge variant="outline">Submitted by {actorName(audit.submittedBy)}</Badge></CardTitle></CardHeader><CardContent className="space-y-4">
      <AuditItemsTable items={audit.items} discrepanciesOnly />
      {!canApprove ? <p className="text-sm text-amber-700">Inventory Manage access is required to review audits.</p> : ownSubmission ? <p className="text-sm text-amber-700">A different Inventory Manager must review this audit.</p> : <div className="flex flex-col md:flex-row gap-3"><Textarea placeholder="Required reason when returning this audit" value={rejectionReasons[audit._id] || ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [audit._id]: event.target.value }))} /><div className="flex gap-2 shrink-0"><Button onClick={() => act('approveAudit', audit)} disabled={!!busy}>Approve and adjust stock</Button><Button variant="outline" onClick={() => act('rejectAudit', audit, rejectionReasons[audit._id])} disabled={!!busy || !rejectionReasons[audit._id]?.trim()}>Return for correction</Button></div></div>}
    </CardContent></Card>
  })}</div>
}

function HistoryTab({ storeNo, refreshKey }) {
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [summaryResult, historyResult] = await Promise.all([
      window.electronAPI.realmOperation('getAuditSummary', storeNo),
      window.electronAPI.realmOperation('getAuditHistory', storeNo, 50),
    ])
    if (summaryResult.success) setSummary(summaryResult.summary)
    if (historyResult.success) setHistory(historyResult.audits || [])
    setLoading(false)
  }, [storeNo])
  useEffect(() => { load() }, [load, refreshKey])

  const view = async (id) => {
    const result = await window.electronAPI.realmOperation('getAudit', id)
    if (result.success) setSelected(result.audit)
    else toast({ title: 'Could not load audit', description: result.error, variant: 'destructive' })
  }
  const chartData = [...history].reverse().map((audit) => ({ date: audit.auditDate || displayDate(audit.completedAt), shrinkageRate: audit.summary?.shrinkageRate || 0, accuracyRate: audit.summary?.accuracyRate ?? 100 }))
  if (loading) return <Loading />
  return <div className="space-y-4">
    {summary && <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><MiniCard label="Daily audits" value={summary.totalAudits} /><MiniCard label="Latest shrinkage" value={money(summary.latestShrinkageValue)} color="text-red-600" /><MiniCard label="Latest accuracy" value={`${summary.latestAccuracyRate}%`} color="text-green-600" /><TrendCard summary={summary} /></div>}
    {chartData.length > 1 && <Card><CardHeader><CardTitle>Daily sold-item accuracy</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis unit="%" /><RechartsTooltip /><Line type="monotone" dataKey="shrinkageRate" stroke="#ef4444" name="Shrinkage" /><Line type="monotone" dataKey="accuracyRate" stroke="#22c55e" name="Accuracy" /></LineChart></ResponsiveContainer></CardContent></Card>}
    <Card><CardHeader><CardTitle>Approved audit history</CardTitle></CardHeader><CardContent>{!history.length ? <p className="py-10 text-center text-neutral-500">No approved daily audits yet.</p> : <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Sales date</TableHead><TableHead>Approved by</TableHead><TableHead className="text-center">Products</TableHead><TableHead className="text-center">Differences</TableHead><TableHead className="text-center">Accuracy</TableHead><TableHead /></TableRow></TableHeader><TableBody>{history.map((audit) => <TableRow key={audit._id}><TableCell>{audit.auditDate || displayDate(audit.completedAt)}</TableCell><TableCell>{actorName(audit.approvedBy)}</TableCell><TableCell className="text-center">{audit.summary?.totalProducts || 0}</TableCell><TableCell className="text-center">{audit.summary?.discrepancyCount || 0}</TableCell><TableCell className="text-center">{audit.summary?.accuracyRate ?? 100}%</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => view(audit._id)}>View</Button></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Audit {selected?.auditDate || ''}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><p className="text-sm text-neutral-500">Created by {actorName(selected.createdBy)} · Submitted by {actorName(selected.submittedBy)} · Approved by {actorName(selected.approvedBy)}</p><AuditResultCards summary={selected.summary} /><AuditItemsTable items={selected.items} /></div>}</DialogContent></Dialog>
  </div>
}

function AuditResultCards({ summary }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><MiniCard label="Sold products audited" value={summary?.totalProducts || 0} /><MiniCard label="Discrepancies" value={summary?.discrepancyCount || 0} color="text-red-600" /><MiniCard label="Net shrinkage value" value={money(summary?.totalShrinkageValue)} color="text-red-600" /><MiniCard label="Accuracy" value={`${summary?.accuracyRate ?? 100}%`} color="text-green-600" /></div>
}

function AuditItemsTable({ items = [], discrepanciesOnly = false }) {
  const shown = [...items].filter((item) => !discrepanciesOnly || Number(item.variance) !== 0).sort((a, b) => Math.abs(Number(b.variance) || 0) - Math.abs(Number(a.variance) || 0))
  if (!shown.length) return <p className="py-6 text-center text-sm text-neutral-500">No discrepancies were recorded.</p>
  return <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-center">Sold</TableHead><TableHead className="text-center">App</TableHead><TableHead className="text-center">Actual</TableHead><TableHead className="text-center">Variance</TableHead><TableHead>Reason / resolution</TableHead></TableRow></TableHeader><TableBody>{shown.map((item) => <TableRow key={item.productId} className={Number(item.variance) ? 'bg-red-50/50' : ''}><TableCell className="font-medium">{item.productName}</TableCell><TableCell className="text-center">{item.netSoldQuantity ?? '—'}</TableCell><TableCell className="text-center">{item.systemStock}</TableCell><TableCell className="text-center">{item.physicalCount ?? '—'}</TableCell><TableCell className="text-center">{item.variance == null ? '—' : Number(item.variance) > 0 ? `-${item.variance}` : Number(item.variance) < 0 ? `+${Math.abs(item.variance)}` : '0'}</TableCell><TableCell><p>{item.reason || '—'}</p>{item.resolution && <p className="text-xs text-neutral-500">Settled: {item.resolution}</p>}</TableCell></TableRow>)}</TableBody></Table></div>
}

function TrendCard({ summary }) {
  const Icon = summary.trend === 'improving' ? TrendingDown : summary.trend === 'worsening' ? TrendingUp : Minus
  const color = summary.trend === 'improving' ? 'text-green-600' : summary.trend === 'worsening' ? 'text-red-600' : 'text-neutral-600'
  return <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center justify-between"><div><p className="text-xs text-neutral-500">Trend</p><p className={`text-xl font-bold capitalize ${color}`}>{summary.trend}</p></div><Icon className={`h-5 w-5 ${color}`} /></div></CardContent></Card>
}

function MiniCard({ label, value, color = 'text-neutral-900' }) {
  return <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-neutral-500">{label}</p><p className={`text-xl font-bold ${color}`}>{value}</p></CardContent></Card>
}

function Loading() {
  return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-neutral-400" /></div>
}
