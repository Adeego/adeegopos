'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Clock, Eye, History, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import useWsinfoStore from '@/stores/wsinfo'

const amount = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const actorName = (actor) => actor?.name || `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() || 'Not recorded'
const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-KE') : 'Not recorded'
const formatDuration = (minutes) => minutes == null ? 'Not recorded' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const hasVariance = (shift) => Math.abs(Number(shift?.variances?.cash || 0)) > 0.009 || Math.abs(Number(shift?.variances?.mpesa || 0)) > 0.009
const hasException = (shift) => hasVariance(shift) || (shift?.unpaidDeclarations?.length || 0) > 0 || (shift?.takeoverHistory?.length || 0) > 0

function Variance({ value }) {
  const number = Number(value || 0)
  return <span className={number < 0 ? 'font-semibold text-red-600' : number > 0 ? 'font-semibold text-amber-600' : 'text-emerald-700'}>{amount(number)}</span>
}

function BalanceAudit({ shift }) {
  const rows = [
    ['Cash', 'cash'],
    ['M-Pesa', 'mpesa'],
    ['Total', 'total'],
  ]
  return <Table>
    <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Movement</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(([label, key]) => <TableRow key={key}><TableCell className="font-medium">{label}</TableCell><TableCell className="text-right">{amount(shift.openingBalances?.[key])}</TableCell><TableCell className="text-right">{amount(shift.movements?.[key])}</TableCell><TableCell className="text-right">{amount(shift.expectedBalances?.[key])}</TableCell><TableCell className="text-right">{amount(shift.countedBalances?.[key])}</TableCell><TableCell className="text-right"><Variance value={shift.variances?.[key]} /></TableCell></TableRow>)}</TableBody>
  </Table>
}

function ShiftDetails({ shift, onOpenChange }) {
  return <Dialog open={Boolean(shift)} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
      {shift && <>
        <DialogHeader><DialogTitle>Closed shift audit</DialogTitle><DialogDescription>{shift._id}</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Business date</p><p className="font-semibold">{shift.businessDate}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Assigned cashier</p><p className="font-semibold">{actorName(shift.openedBy)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Opened</p><p className="font-semibold">{formatDateTime(shift.openedAt)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Closed</p><p className="font-semibold">{formatDateTime(shift.closedAt)}</p></CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="text-base">Balance reconciliation</CardTitle><CardDescription>Only Cash and M-Pesa are included.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><BalanceAudit shift={shift} /></CardContent></Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Responsibility and approval</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Opened by</span><span className="text-right font-medium">{actorName(shift.openedBy)}</span></div>
            {shift.originalOpenedBy && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Original cashier</span><span className="text-right font-medium">{actorName(shift.originalOpenedBy)}</span></div>}
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Closed by</span><span className="text-right font-medium">{actorName(shift.closedBy)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Exception approved by</span><span className="text-right font-medium">{actorName(shift.exceptionApprovedBy)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Duration</span><span className="font-medium">{formatDuration(shift.durationMinutes)}</span></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Audit status</CardTitle></CardHeader><CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2"><Badge variant={hasVariance(shift) ? 'destructive' : 'secondary'}>{hasVariance(shift) ? 'Variance recorded' : 'Balanced'}</Badge>{shift.exceptionApprovedBy && <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />Manager approved</Badge>}{shift.takeoverHistory.length > 0 && <Badge variant="outline">Emergency takeover</Badge>}</div>
            <p className="text-sm text-muted-foreground">Cash account: {shift.linkedAccountIds?.cash || 'Not recorded'}</p>
            <p className="text-sm text-muted-foreground">M-Pesa account: {shift.linkedAccountIds?.mpesa || 'Not recorded'}</p>
          </CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="text-base">Unpaid non-credit declarations ({shift.unpaidDeclarations.length})</CardTitle></CardHeader><CardContent>{shift.unpaidDeclarations.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : <div className="space-y-3">{shift.unpaidDeclarations.map((entry) => <div key={entry.saleId} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{entry.saleId}</span><strong>{amount(entry.totalAmount)}</strong></div><p className="mt-1 text-muted-foreground">{entry.paymentMethod || 'Payment method not recorded'} · {formatDateTime(entry.createdAt)}</p><p className="mt-2"><span className="font-medium">Declaration:</span> {entry.reason || 'No reason recorded'}</p></div>)}</div>}</CardContent></Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Emergency takeover history ({shift.takeoverHistory.length})</CardTitle></CardHeader><CardContent>{shift.takeoverHistory.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : <div className="space-y-3">{shift.takeoverHistory.map((entry, index) => <div key={`${entry.at}-${index}`} className="rounded-md border p-3 text-sm"><p><strong>{actorName(entry.from)}</strong> → <strong>{actorName(entry.to)}</strong></p><p className="text-muted-foreground">{formatDateTime(entry.at)}</p><p className="mt-1">{entry.reason || 'No reason recorded'}</p></div>)}</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Balance adjustments ({shift.adjustments.length})</CardTitle></CardHeader><CardContent>{shift.adjustments.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : <div className="space-y-3">{shift.adjustments.map((entry) => <div key={entry._id} className="rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium capitalize">{entry.source}</span><Variance value={entry.delta} /></div><p className="text-muted-foreground">{entry.reason || 'Closing balance reconciliation'}</p></div>)}</div>}</CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="text-base">Closing notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{shift.notes || 'No notes recorded.'}</p></CardContent></Card>
      </>}
    </DialogContent>
  </Dialog>
}

export default function ShiftHistoryPage() {
  const storeNo = useWsinfoStore((state) => state.wsinfo?.storeNo || '')
  const { toast } = useToast()
  const [shifts, setShifts] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [outcome, setOutcome] = useState('all')

  const load = useCallback(async () => {
    if (!storeNo) return
    setLoading(true)
    try {
      const result = await window.electronAPI.realmOperation('getRegisterSessionHistory', { storeNo })
      if (!result.success) throw new Error(result.error)
      setShifts(result.sessions || [])
    } catch (error) {
      toast({ title: 'Unable to load shift history', description: error.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }, [storeNo, toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => shifts.filter((shift) => {
    const haystack = `${shift._id} ${actorName(shift.openedBy)} ${actorName(shift.closedBy)} ${shift.businessDate}`.toLowerCase()
    if (search && !haystack.includes(search.toLowerCase())) return false
    if (fromDate && String(shift.businessDate) < fromDate) return false
    if (toDate && String(shift.businessDate) > toDate) return false
    if (outcome === 'balanced' && hasException(shift)) return false
    if (outcome === 'exceptions' && !hasException(shift)) return false
    return true
  }), [shifts, search, fromDate, toDate, outcome])

  const totals = useMemo(() => filtered.reduce((sum, shift) => ({
    cash: sum.cash + Number(shift.variances?.cash || 0),
    mpesa: sum.mpesa + Number(shift.variances?.mpesa || 0),
    exceptions: sum.exceptions + (hasException(shift) ? 1 : 0),
  }), { cash: 0, mpesa: 0, exceptions: 0 }), [filtered])

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><History className="h-6 w-6" />Shift History</h1><p className="text-sm text-muted-foreground">Immutable closing records and register exception audit trail.</p></div><div className="flex gap-2"><Link href="/cashier/sales"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Cashier & Register</Button></Link><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div></div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Closed shifts shown</p><p className="text-2xl font-bold">{filtered.length}</p></CardContent></Card>
      <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Shifts with exceptions</p><p className="text-2xl font-bold">{totals.exceptions}</p></CardContent></Card>
      <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net cash variance</p><p className="text-xl font-bold"><Variance value={totals.cash} /></p></CardContent></Card>
      <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net M-Pesa variance</p><p className="text-xl font-bold"><Variance value={totals.mpesa} /></p></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="text-base">Find a closed shift</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><div className="space-y-1"><Label>Cashier or shift ID</Label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" /></div></div><div className="space-y-1"><Label>From date</Label><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div><div className="space-y-1"><Label>To date</Label><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div><div className="space-y-1"><Label>Outcome</Label><Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All shifts</SelectItem><SelectItem value="balanced">Balanced only</SelectItem><SelectItem value="exceptions">Exceptions only</SelectItem></SelectContent></Select></div></CardContent></Card>

    <Card><CardContent className="overflow-x-auto pt-4">{loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading closed shifts…</div> : filtered.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No closed shifts match these filters.</div> : <Table><TableHeader><TableRow><TableHead>Closed</TableHead><TableHead>Cashier</TableHead><TableHead>Duration</TableHead><TableHead className="text-right">Cash variance</TableHead><TableHead className="text-right">M-Pesa variance</TableHead><TableHead>Audit</TableHead><TableHead /></TableRow></TableHeader><TableBody>{filtered.map((shift) => <TableRow key={shift._id}><TableCell><p className="font-medium">{shift.businessDate}</p><p className="text-xs text-muted-foreground">{formatDateTime(shift.closedAt)}</p></TableCell><TableCell>{actorName(shift.openedBy)}</TableCell><TableCell><span className="inline-flex items-center"><Clock className="mr-1 h-3 w-3" />{formatDuration(shift.durationMinutes)}</span></TableCell><TableCell className="text-right"><Variance value={shift.variances?.cash} /></TableCell><TableCell className="text-right"><Variance value={shift.variances?.mpesa} /></TableCell><TableCell>{hasException(shift) ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Exception</Badge> : <Badge variant="secondary">Balanced</Badge>}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setSelected(shift)}><Eye className="mr-1 h-4 w-4" />Details</Button></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
    <p className="text-xs text-muted-foreground">Showing up to the latest 1,000 closed shifts. Closed records cannot be edited from this screen.</p>
    <ShiftDetails shift={selected} onOpenChange={(next) => { if (!next) setSelected(null) }} />
  </div>
}
