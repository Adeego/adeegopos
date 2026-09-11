'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, Lock, PlayCircle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import useStaffStore from '@/stores/staffStore'
import useWsinfoStore from '@/stores/wsinfo'
import { can } from '@/lib/rbac'

const money = (value) => `KES ${Number(value || 0).toFixed(2)}`
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const actorId = (actor) => actor?._id || actor?.id || null
const REGISTER_LOAD_TIMEOUT_MS = 30000

const withTimeout = (promise, milliseconds) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Register loading timed out. Check database sync and try again.')), milliseconds)),
])

export default function RegisterBalancing({ defaultOpen = false, onShiftChange }) {
  const { toast } = useToast()
  const staff = useStaffStore((state) => state.staff)
  const storeNo = useWsinfoStore((state) => state.wsinfo?.storeNo || '')
  const [open, setOpen] = useState(defaultOpen)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState(null)
  const [centralControl, setCentralControl] = useState(null)
  const [previous, setPrevious] = useState(null)
  const [defaults, setDefaults] = useState({ cash: 0, mpesa: 0 })
  const [setupError, setSetupError] = useState('')
  const [cash, setCash] = useState('0')
  const [mpesa, setMpesa] = useState('0')
  const [notes, setNotes] = useState('')
  const [reasons, setReasons] = useState({})
  const [managerPhone, setManagerPhone] = useState('')
  const [managerPasscode, setManagerPasscode] = useState('')
  const [takeoverReason, setTakeoverReason] = useState('')
  const [approvalRequired, setApprovalRequired] = useState(false)

  const load = useCallback(async () => {
    if (!storeNo) return
    setLoading(true)
    try {
      const result = await withTimeout(
        window.electronAPI.realmOperation('getRegisterSession', storeNo),
        REGISTER_LOAD_TIMEOUT_MS
      )
      if (!result.success) throw new Error(result.error)
      setSession(result.activeSession || null)
      setCentralControl(result.centralControl || null)
      setPrevious(result.previousClosedSession || null)
      setDefaults(result.openingDefaults || { cash: 0, mpesa: 0 })
      setSetupError(result.setupError || '')
      setCash(String(result.activeSession?.countedBalances?.cash || 0))
      setMpesa(String(result.activeSession?.countedBalances?.mpesa || 0))
      setNotes(result.activeSession?.notes || '')
    } catch (error) {
      toast({ title: 'Register error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [storeNo, toast])

  useEffect(() => { if (open) load() }, [open, load])

  const isShiftCashier = actorId(session?.openedBy) === actorId(staff)
  const unpaid = session?.unpaidDeclarations || []
  const counted = useMemo(() => ({ cash: number(cash), mpesa: number(mpesa) }), [cash, mpesa])
  const needsApproval = unpaid.length > 0 || approvalRequired
  const firstShift = !previous
  const isCentralShiftCashier = actorId(centralControl?.cashier) === actorId(staff)

  const openShift = async () => {
    setBusy(true)
    try {
      const result = await window.electronAPI.realmOperation('openRegisterSession', {
        storeNo,
        openingBalances: firstShift ? { cash: number(cash), mpesa: number(mpesa) } : undefined,
      })
      if (!result.success) {
        if (result.control?.status === 'open') await load()
        throw new Error(result.error)
      }
      setSession(result.activeSession)
      setCentralControl(null)
      setCash('0'); setMpesa('0')
      onShiftChange?.(result.activeSession)
      toast({ title: 'Shift opened', description: 'This register is now assigned to you.' })
    } catch (error) {
      toast({ title: 'Unable to open shift', description: error.message, variant: 'destructive' })
    } finally { setBusy(false) }
  }

  const closeShift = async () => {
    setBusy(true)
    try {
      const result = await window.electronAPI.realmOperation('closeRegisterSession', {
        storeNo, sessionId: session._id, countedBalances: counted, notes,
        unpaidDeclarations: unpaid.map((sale) => ({ saleId: sale.saleId, reason: reasons[sale.saleId] || '' })),
        managerPhone: needsApproval ? managerPhone : '',
        managerPasscode: needsApproval ? managerPasscode : '',
      })
      if (!result.success) {
        if (result.approvalRequired) setApprovalRequired(true)
        throw new Error(result.error)
      }
      setSession(null)
      setCentralControl(null)
      setPrevious(result.closedSession)
      setDefaults(result.closedSession.countedBalances)
      setManagerPhone(''); setManagerPasscode(''); setReasons({})
      setApprovalRequired(false)
      onShiftChange?.(null)
      toast({ title: 'Shift closed', description: result.warning || 'Closing balances are locked and will open the next shift.' })
    } catch (error) {
      toast({ title: 'Unable to close shift', description: error.message, variant: 'destructive' })
    } finally { setBusy(false) }
  }

  const takeOver = async () => {
    setBusy(true)
    try {
      const result = await window.electronAPI.realmOperation('takeOverRegisterSession', { storeNo, sessionId: session._id, reason: takeoverReason })
      if (!result.success) throw new Error(result.error)
      setSession(result.activeSession)
      setCentralControl(null)
      setTakeoverReason('')
      onShiftChange?.(result.activeSession)
      toast({ title: 'Shift taken over', description: 'The emergency takeover was recorded in the audit history.' })
    } catch (error) {
      toast({ title: 'Unable to take over shift', description: error.message, variant: 'destructive' })
    } finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline"><Calculator className="mr-2 h-4 w-4" />Register Shift</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Register Shift</DialogTitle><DialogDescription>Cash and M-Pesa only. Every movement is assigned to one cashier and one shift.</DialogDescription></DialogHeader>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading shift…</p> : <div className="space-y-4">
        {setupError && <Card className="border-red-200 bg-red-50"><CardContent className="pt-4 text-sm text-red-700">{setupError}</CardContent></Card>}
        {!session && centralControl?.status === 'open' ? <Card className="border-amber-200 bg-amber-50"><CardContent className="space-y-3 pt-4 text-sm text-amber-800">
          <div><p className="text-xs">Active central shift</p><p className="font-semibold">{centralControl.cashier?.name || 'Another cashier'}</p></div>
          {isCentralShiftCashier
            ? <><p>Your shift is active centrally but has not reached this device yet.</p><Button onClick={openShift} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />{busy ? 'Recovering…' : 'Recover my shift'}</Button></>
            : <p>Wait until this cashier closes the shift.</p>}
        </CardContent></Card> : !session ? <>
          <Card><CardHeader><CardTitle className="text-base">Open next shift</CardTitle></CardHeader><CardContent className="space-y-4">
            {firstShift ? <><p className="text-sm text-amber-700">First shift only: a POS manager must establish the initial balances.</p>
              <div className="grid gap-3 sm:grid-cols-2"><div><Label>Opening Cash</Label><Input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} /></div><div><Label>Opening M-Pesa</Label><Input type="number" min="0" value={mpesa} onChange={(e) => setMpesa(e.target.value)} /></div></div></>
              : <div className="grid gap-3 sm:grid-cols-2"><div className="rounded border p-3"><p className="text-xs text-muted-foreground">Opening Cash</p><p className="font-semibold">{money(defaults.cash)}</p></div><div className="rounded border p-3"><p className="text-xs text-muted-foreground">Opening M-Pesa</p><p className="font-semibold">{money(defaults.mpesa)}</p></div></div>}
            <Button onClick={openShift} disabled={busy || !!setupError || !can(staff, 'cashier:manage')}><PlayCircle className="mr-2 h-4 w-4" />{busy ? 'Opening…' : 'Open my shift'}</Button>
          </CardContent></Card>
        </> : <>
          <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4"><div><p className="text-xs text-muted-foreground">Assigned cashier</p><p className="font-semibold">{session.openedBy?.name || 'Unknown'}</p></div><Badge>{isShiftCashier ? 'Your shift' : 'Shift in progress'}</Badge></CardContent></Card>
          {!isShiftCashier ? <Card className="border-amber-200 bg-amber-50"><CardContent className="space-y-3 pt-4 text-sm text-amber-800"><div className="flex gap-2"><Lock className="h-4 w-4" />Wait until this cashier closes the shift.</div>{can(staff, 'cashier:manage') && <div className="space-y-2 border-t border-amber-200 pt-3"><Label>Emergency takeover reason</Label><Input value={takeoverReason} onChange={(e) => setTakeoverReason(e.target.value)} placeholder="Required and permanently audited" /><Button variant="destructive" onClick={takeOver} disabled={busy || !takeoverReason.trim()}>Take over shift</Button></div>}</CardContent></Card> : <>
            <Card><CardHeader><CardTitle className="text-base">Declare closing balances</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div><Label>Cash counted</Label><Input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} /></div><div><Label>M-Pesa balance</Label><Input type="number" min="0" value={mpesa} onChange={(e) => setMpesa(e.target.value)} /></div></CardContent></Card>
            {unpaid.length > 0 && <Card><CardHeader><CardTitle className="text-base">Unpaid non-credit sales to declare</CardTitle></CardHeader><CardContent className="space-y-3">{unpaid.map((sale) => <div key={sale.saleId} className="rounded border p-3"><div className="mb-2 flex justify-between gap-3 text-sm"><span>{sale.saleId}</span><strong>{money(sale.totalAmount)}</strong></div><Input placeholder="Required reason payment is still unconfirmed" value={reasons[sale.saleId] || ''} onChange={(e) => setReasons((current) => ({ ...current, [sale.saleId]: e.target.value }))} /></div>)}</CardContent></Card>}
            <Card><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></CardContent></Card>
            {needsApproval && <Card className="border-amber-200"><CardHeader><CardTitle className="text-base">Independent manager approval required</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div><Label>Manager phone</Label><Input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} /></div><div><Label>Manager passcode</Label><Input type="password" value={managerPasscode} onChange={(e) => setManagerPasscode(e.target.value)} /></div></CardContent></Card>}
            <Button onClick={closeShift} disabled={busy || counted.cash < 0 || counted.mpesa < 0 || unpaid.some((sale) => !(reasons[sale.saleId] || '').trim()) || (needsApproval && (!managerPhone || !managerPasscode))}>{busy ? 'Closing…' : 'Close shift'}</Button>
          </>}
        </>}
        <Button variant="ghost" size="sm" onClick={load} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>}
    </DialogContent>
  </Dialog>
}
