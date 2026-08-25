'use client'

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Calculator, CheckCircle2, Clock, Lock, PlayCircle, RefreshCw, Save, Smartphone, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import useStaffStore from '@/stores/staffStore';
import useWsinfoStore from '@/stores/wsinfo';
import { can } from '@/lib/rbac';

const toCurrency = (value) => `KES ${Number(value || 0).toFixed(2)}`;

const toInputNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatBusinessDate = (value) => {
  if (!value) {
    return 'Today';
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTodayBusinessDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DifferenceBadge = ({ value }) => {
  const isZero = Number(value || 0) === 0;
  const isPositive = Number(value || 0) > 0;

  return (
    <Badge
      variant={isPositive ? 'default' : isZero ? 'outline' : 'destructive'}
      className={isZero ? 'border-green-200 bg-green-50 text-green-700' : isPositive ? 'bg-blue-500' : ''}
    >
      {value > 0 ? '+' : ''}{toCurrency(value).replace('KES ', '')}
    </Badge>
  );
};

const AccountSummaryCard = ({ icon: Icon, title, account, openingBalance, expectedBalance, countedBalance, variance }) => (
  <Card className="overflow-hidden border-muted shadow-none">
    <CardHeader className="border-b bg-muted/30 p-4">
      <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {title}
        {account ? (
          <Badge variant="outline" className="ml-auto max-w-full">
            {account.name}
          </Badge>
        ) : (
          <Badge variant="destructive" className="ml-auto">
            Not Linked
          </Badge>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 p-4 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Finance Balance</span>
        <span className="font-semibold">{account ? toCurrency(account.balance) : 'N/A'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Opening</span>
        <span className="font-semibold">{toCurrency(openingBalance)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Expected</span>
        <span className="font-semibold">{toCurrency(expectedBalance)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Counted Closing</span>
        <span className="font-semibold">{toCurrency(countedBalance)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Variance</span>
        <DifferenceBadge value={variance} />
      </div>
      {account?.accountNumber && (
        <p className="text-xs text-muted-foreground">Account No: {account.accountNumber}</p>
      )}
    </CardContent>
  </Card>
);

const getCloseTransferEntries = (transfer) => {
  if (!transfer) {
    return [];
  }

  if (Object.prototype.hasOwnProperty.call(transfer, 'cash') || Object.prototype.hasOwnProperty.call(transfer, 'mpesa')) {
    return [
      { key: 'cash', label: 'Cash Transfer', transfer: transfer.cash },
      { key: 'mpesa', label: 'M-Pesa Transfer', transfer: transfer.mpesa },
    ].filter((entry) => entry.transfer && (entry.transfer.amount > 0 || entry.transfer.transactionId));
  }

  return transfer.amount > 0 || transfer.transactionId
    ? [{ key: 'legacy-cash', label: 'Cash Transfer', transfer }]
    : [];
};

export default function RegisterBalancing({ defaultOpen = false }) {
  const { toast } = useToast();
  const staff = useStaffStore((state) => state.staff);
  const store = useWsinfoStore((state) => state.wsinfo);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [session, setSession] = useState(null);
  const [previousClosedSession, setPreviousClosedSession] = useState(null);
  const [openingDefaults, setOpeningDefaults] = useState({ cash: 0, mpesa: 0, total: 0 });
  const [statusSetupError, setStatusSetupError] = useState('');
  const [openingCash, setOpeningCash] = useState('0');
  const [openingMpesa, setOpeningMpesa] = useState('0');
  const [countedCash, setCountedCash] = useState('0');
  const [countedMpesa, setCountedMpesa] = useState('0');
  const [cashTransferAmount, setCashTransferAmount] = useState('0');
  const [cashTransferCost, setCashTransferCost] = useState('0');
  const [cashDestinationAccountId, setCashDestinationAccountId] = useState('');
  const [cashTransferDescription, setCashTransferDescription] = useState('');
  const [mpesaTransferAmount, setMpesaTransferAmount] = useState('0');
  const [mpesaTransferCost, setMpesaTransferCost] = useState('0');
  const [mpesaDestinationAccountId, setMpesaDestinationAccountId] = useState('');
  const [mpesaTransferDescription, setMpesaTransferDescription] = useState('');
  const [notes, setNotes] = useState('');

  const canManageCashier = can(staff, 'cashier:manage');
  const storeNo = store?.storeNo || '';
  const businessDate = getTodayBusinessDate();

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);

  const syncLocalState = useCallback((nextSession) => {
    const closeTransfer = nextSession?.transfer || {};
    const legacyCashTransfer = closeTransfer.amount !== undefined || closeTransfer.transactionId;
    const cashTransfer = closeTransfer.cash || (legacyCashTransfer ? closeTransfer : {});
    const mpesaTransfer = closeTransfer.mpesa || {};

    setSession(nextSession);
    setCountedCash(String(nextSession?.countedBalances?.cash ?? 0));
    setCountedMpesa(String(nextSession?.countedBalances?.mpesa ?? 0));
    setCashTransferAmount(String(cashTransfer.amount ?? 0));
    setCashTransferCost(String(cashTransfer.transactionCost ?? 0));
    setCashDestinationAccountId(cashTransfer.destinationAccountId || '');
    setCashTransferDescription(cashTransfer.description || `Cash close transfer for ${nextSession?.businessDate || businessDate}`);
    setMpesaTransferAmount(String(mpesaTransfer.amount ?? 0));
    setMpesaTransferCost(String(mpesaTransfer.transactionCost ?? 0));
    setMpesaDestinationAccountId(mpesaTransfer.destinationAccountId || '');
    setMpesaTransferDescription(mpesaTransfer.description || `M-Pesa close transfer for ${nextSession?.businessDate || businessDate}`);
    setNotes(nextSession?.notes || '');
  }, [businessDate]);

  const fetchRegisterSession = useCallback(async () => {
    if (!storeNo) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.realmOperation('getRegisterSession', storeNo);
      if (!result.success) {
        throw new Error(result.error || 'Failed to load register session');
      }

      setPreviousClosedSession(result.previousClosedSession || null);
      setStatusSetupError(result.setupError || '');
      const defaults = result.openingDefaults || { cash: 0, mpesa: 0, total: 0 };
      setOpeningDefaults(defaults);

      if (result.activeSession) {
        syncLocalState(result.activeSession);
      } else {
        setSession(null);
        setOpeningCash(String(defaults.cash ?? 0));
        setOpeningMpesa(String(defaults.mpesa ?? 0));
        setCountedCash('0');
        setCountedMpesa('0');
        setCashTransferAmount('0');
        setCashTransferCost('0');
        setCashDestinationAccountId('');
        setCashTransferDescription(`Cash close transfer for ${businessDate}`);
        setMpesaTransferAmount('0');
        setMpesaTransferCost('0');
        setMpesaDestinationAccountId('');
        setMpesaTransferDescription(`M-Pesa close transfer for ${businessDate}`);
        setNotes('');
      }
    } catch (error) {
      console.error('Error loading register session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load register session',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [businessDate, storeNo, syncLocalState, toast]);

  useEffect(() => {
    if (open && storeNo) {
      fetchRegisterSession();
    }
  }, [fetchRegisterSession, open, storeNo]);

  const countedBalances = {
    cash: toInputNumber(countedCash),
    mpesa: toInputNumber(countedMpesa),
  };

  const expectedBalances = session?.expectedBalances || { cash: 0, mpesa: 0, total: 0 };
  const liveCountedTotals = {
    ...countedBalances,
    total: countedBalances.cash + countedBalances.mpesa,
  };
  const liveVariances = {
    cash: Number((liveCountedTotals.cash - Number(expectedBalances.cash || 0)).toFixed(2)),
    mpesa: Number((liveCountedTotals.mpesa - Number(expectedBalances.mpesa || 0)).toFixed(2)),
    total: Number((liveCountedTotals.total - Number(expectedBalances.total || 0)).toFixed(2)),
  };
  const adminTransferAccounts = session?.availableTransferAccounts || [];
  const closeTransferEntries = getCloseTransferEntries(session?.transfer);

  const cashTransferAmountValue = toInputNumber(cashTransferAmount);
  const cashTransferCostValue = toInputNumber(cashTransferCost);
  const mpesaTransferAmountValue = toInputNumber(mpesaTransferAmount);
  const mpesaTransferCostValue = toInputNumber(mpesaTransferCost);
  const remainingDrawerCash = Number((liveCountedTotals.cash - cashTransferAmountValue - cashTransferCostValue).toFixed(2));
  const remainingMpesa = Number((liveCountedTotals.mpesa - mpesaTransferAmountValue - mpesaTransferCostValue).toFixed(2));
  const cashTransferNeedsDestination = cashTransferAmountValue > 0 || cashTransferCostValue > 0;
  const mpesaTransferNeedsDestination = mpesaTransferAmountValue > 0 || mpesaTransferCostValue > 0;
  const cashTransferInvalidCost = cashTransferAmountValue === 0 && cashTransferCostValue > 0;
  const mpesaTransferInvalidCost = mpesaTransferAmountValue === 0 && mpesaTransferCostValue > 0;
  const setupError = session?.setupError || statusSetupError || '';
  const sessionClosed = session?.status === 'closed';
  const canEdit = canManageCashier && !setupError && !sessionClosed;
  const canClose = canEdit
    && !closing
    && remainingDrawerCash >= 0
    && remainingMpesa >= 0
    && !cashTransferInvalidCost
    && !mpesaTransferInvalidCost
    && (!cashTransferNeedsDestination || cashDestinationAccountId)
    && (!mpesaTransferNeedsDestination || mpesaDestinationAccountId);
  const canOpen = canManageCashier && !setupError && !session && !opening;

  const handleOpenSession = async () => {
    if (!canOpen) {
      toast({
        title: 'Unable to Open',
        description: setupError || 'Your roles do not allow opening the register.',
        variant: 'destructive',
      });
      return;
    }

    setOpening(true);
    try {
      const result = await window.electronAPI.realmOperation('openRegisterSession', {
        storeNo,
        openingBalances: {
          cash: toInputNumber(openingCash),
          mpesa: toInputNumber(openingMpesa),
        },
      }, staff);

      if (!result.success) {
        throw new Error(result.error || 'Failed to open register session');
      }

      setPreviousClosedSession(result.previousClosedSession || null);
      setStatusSetupError(result.setupError || '');
      setOpeningDefaults(result.openingDefaults || openingDefaults);
      syncLocalState(result.activeSession || result.session);
      toast({
        title: 'Register Opened',
        description: 'Register session opened successfully.',
      });
    } catch (error) {
      console.error('Error opening register session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to open register session',
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: 'Access Denied',
        description: setupError || 'Only admins can save register balances.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.realmOperation('saveRegisterSession', {
        storeNo,
        sessionId: session?._id,
        countedBalances,
        notes,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save register session');
      }

      syncLocalState(result.session);
      toast({
        title: 'Saved',
        description: 'Register draft saved successfully.',
      });
    } catch (error) {
      console.error('Error saving register session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save register session',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRegister = async () => {
    if (!canClose) {
      toast({
        title: 'Unable to Close',
        description: setupError || 'Complete the transfer details and ensure remaining cash and M-Pesa are not negative.',
        variant: 'destructive',
      });
      return;
    }

    setClosing(true);
    try {
      const result = await window.electronAPI.realmOperation('closeRegisterSession', {
        storeNo,
        sessionId: session?._id,
        countedBalances,
        notes,
        transfer: {
          cash: {
            destinationAccountId: cashDestinationAccountId,
            amount: cashTransferAmountValue,
            transactionCost: cashTransferCostValue,
            description: cashTransferDescription,
          },
          mpesa: {
            destinationAccountId: mpesaDestinationAccountId,
            amount: mpesaTransferAmountValue,
            transactionCost: mpesaTransferCostValue,
            description: mpesaTransferDescription,
          },
        },
      }, staff);

      if (!result.success) {
        throw new Error(result.error || 'Failed to close register');
      }

      syncLocalState(result.session);
      toast({
        title: 'Register Closed',
        description: cashTransferAmountValue > 0 || mpesaTransferAmountValue > 0
          ? 'Register closed and transfer transactions posted successfully.'
          : 'Register closed successfully.',
      });
    } catch (error) {
      console.error('Error closing register:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to close register',
        variant: 'destructive',
      });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Calculator className="mr-2 h-4 w-4" />
          Balance Register
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b bg-muted/30 px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <Calculator className="h-5 w-5" />
            Register Balancing
            {sessionClosed && <Badge className="bg-green-500">Closed</Badge>}
          </DialogTitle>
          <DialogDescription>
            {session ? formatBusinessDate(session.businessDate || businessDate) : 'No open register session'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-4 sm:p-6">
            {!canManageCashier && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-3 text-sm text-amber-700">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Your roles do not allow saving or closing the register.
                  </div>
                </CardContent>
              </Card>
            )}

            {setupError && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-3 text-sm text-red-700">
                  {setupError}
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Loading register session...
                </CardContent>
              </Card>
            )}

            {!loading && !session && (
              <>
                <Card className="border-muted shadow-none">
                  <CardHeader className="border-b bg-muted/30 p-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <PlayCircle className="h-4 w-4" />
                      Start Register Session
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Opening Cash</Label>
                        <Input
                          type="number"
                          value={openingCash}
                          onChange={(event) => setOpeningCash(event.target.value)}
                          disabled={!canOpen}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Opening M-Pesa</Label>
                        <Input
                          type="number"
                          value={openingMpesa}
                          onChange={(event) => setOpeningMpesa(event.target.value)}
                          disabled={!canOpen}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Suggested Opening</span>
                        <span className="font-semibold">{toCurrency(openingDefaults.total)}</span>
                      </div>
                      {previousClosedSession?.closedAt && (
                        <div className="mt-2 flex justify-between">
                          <span className="text-muted-foreground">Previous Close</span>
                          <span className="font-semibold">{formatDateTime(previousClosedSession.closedAt)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {previousClosedSession && (
                  <Card className="border-muted shadow-none">
                    <CardHeader className="border-b bg-muted/30 p-4">
                      <CardTitle className="text-sm font-medium">Last Closed Session</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 p-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected Total</span>
                        <span className="font-semibold">{toCurrency(previousClosedSession.expectedBalances?.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Counted Total</span>
                        <span className="font-semibold">{toCurrency(previousClosedSession.countedBalances?.total)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Variance</span>
                        <DifferenceBadge value={previousClosedSession.variances?.total || 0} />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!loading && session && (
              <>
                <Card className="border-muted bg-muted/30 shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium">Session Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 p-4 pt-0 text-sm sm:grid-cols-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Opened</span>
                      <span className="font-semibold">{formatDateTime(session.openedAt || session.createdAt)}</span>
                    </div>
                    {session.closedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Closed</span>
                        <span className="font-semibold">{formatDateTime(session.closedAt)}</span>
                      </div>
                    )}
                    {session.closedBy?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Closed By</span>
                        <span className="font-semibold">{session.closedBy.name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <AccountSummaryCard
                    icon={Wallet}
                    title="Cash"
                    account={session.linkedAccounts?.cash}
                    openingBalance={session.openingBalances?.cash}
                    expectedBalance={expectedBalances.cash}
                    countedBalance={liveCountedTotals.cash}
                    variance={liveVariances.cash}
                  />
                  <AccountSummaryCard
                    icon={Smartphone}
                    title="M-Pesa"
                    account={session.linkedAccounts?.mpesa}
                    openingBalance={session.openingBalances?.mpesa}
                    expectedBalance={expectedBalances.mpesa}
                    countedBalance={liveCountedTotals.mpesa}
                    variance={liveVariances.mpesa}
                  />
                </div>

                <Card className="border-muted shadow-none">
                  <CardHeader className="border-b bg-muted/30 p-4">
                    <CardTitle className="text-sm font-medium">Counted Closing Balances</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cash Closing</Label>
                      <Input
                        type="number"
                        value={countedCash}
                        onChange={(event) => setCountedCash(event.target.value)}
                        disabled={!canEdit}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">M-Pesa Closing</Label>
                      <Input
                        type="number"
                        value={countedMpesa}
                        onChange={(event) => setCountedMpesa(event.target.value)}
                        disabled={!canEdit}
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-muted shadow-none">
                  <CardHeader className="border-b bg-muted/30 p-4">
                    <CardTitle className="text-sm font-medium">Session Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      disabled={!canEdit}
                      className="min-h-20"
                    />
                  </CardContent>
                </Card>

                <Card className="border-muted shadow-none">
                  <CardHeader className="border-b bg-muted/30 p-4">
                    <CardTitle className="text-sm font-medium">Close Transfers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    {adminTransferAccounts.length === 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                        Create an active Admin account before transferring close balances.
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                          <Wallet className="h-4 w-4" />
                          Cash to Admin
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Amount</Label>
                            <Input
                              type="number"
                              value={cashTransferAmount}
                              onChange={(event) => setCashTransferAmount(event.target.value)}
                              disabled={!canEdit || adminTransferAccounts.length === 0}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Transfer Cost</Label>
                            <Input
                              type="number"
                              value={cashTransferCost}
                              onChange={(event) => setCashTransferCost(event.target.value)}
                              disabled={!canEdit || adminTransferAccounts.length === 0}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Destination Admin Account</Label>
                          <Select
                            value={cashDestinationAccountId}
                            onValueChange={setCashDestinationAccountId}
                            disabled={!canEdit || adminTransferAccounts.length === 0}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select Admin account" />
                            </SelectTrigger>
                            <SelectContent>
                              {adminTransferAccounts.map((account) => (
                                <SelectItem key={account._id} value={account._id}>
                                  {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <Input
                            value={cashTransferDescription}
                            onChange={(event) => setCashTransferDescription(event.target.value)}
                            disabled={!canEdit || adminTransferAccounts.length === 0}
                            className="mt-1"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
                          <span className="text-muted-foreground">Remaining Cash</span>
                          <span className={`font-semibold ${remainingDrawerCash < 0 ? 'text-red-600' : ''}`}>
                            {toCurrency(remainingDrawerCash)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                          <Smartphone className="h-4 w-4" />
                          M-Pesa to Admin
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Amount</Label>
                            <Input
                              type="number"
                              value={mpesaTransferAmount}
                              onChange={(event) => setMpesaTransferAmount(event.target.value)}
                              disabled={!canEdit || adminTransferAccounts.length === 0}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Transfer Cost</Label>
                            <Input
                              type="number"
                              value={mpesaTransferCost}
                              onChange={(event) => setMpesaTransferCost(event.target.value)}
                              disabled={!canEdit || adminTransferAccounts.length === 0}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Destination Admin Account</Label>
                          <Select
                            value={mpesaDestinationAccountId}
                            onValueChange={setMpesaDestinationAccountId}
                            disabled={!canEdit || adminTransferAccounts.length === 0}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select Admin account" />
                            </SelectTrigger>
                            <SelectContent>
                              {adminTransferAccounts.map((account) => (
                                <SelectItem key={account._id} value={account._id}>
                                  {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <Input
                            value={mpesaTransferDescription}
                            onChange={(event) => setMpesaTransferDescription(event.target.value)}
                            disabled={!canEdit || adminTransferAccounts.length === 0}
                            className="mt-1"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
                          <span className="text-muted-foreground">Remaining M-Pesa</span>
                          <span className={`font-semibold ${remainingMpesa < 0 ? 'text-red-600' : ''}`}>
                            {toCurrency(remainingMpesa)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-muted shadow-none">
                  <CardHeader className="border-b bg-muted/30 p-4">
                    <CardTitle className="text-sm font-medium">Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Total</span>
                      <span className="font-semibold">{toCurrency(expectedBalances.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Counted Total</span>
                      <span className="font-semibold">{toCurrency(liveCountedTotals.total)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Variance</span>
                      <DifferenceBadge value={liveVariances.total} />
                    </div>
                    {session.closeSummary && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cash After Close</span>
                          <span className="font-semibold">{toCurrency(session.closeSummary.remainingDrawerCash)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">M-Pesa After Close</span>
                          <span className="font-semibold">{toCurrency(session.closeSummary.remainingMpesa ?? session.countedBalances?.mpesa)}</span>
                        </div>
                      </>
                    )}
                    {closeTransferEntries.length > 0 && (
                      <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                        <div className="flex items-center gap-2 font-medium">
                          <ArrowRightLeft className="h-4 w-4" />
                          Close Transfers
                        </div>
                        {closeTransferEntries.map((entry) => (
                          <p key={entry.key} className="text-xs text-muted-foreground">
                            {entry.label}: {toCurrency(entry.transfer.amount)} moved to {entry.transfer.destinationAccountName}
                            {entry.transfer.transactionCost > 0 ? ` with ${toCurrency(entry.transfer.transactionCost)} transfer cost.` : '.'}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
        {!loading && session && (
          <div className="flex flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:flex-wrap sm:px-6">
            <Button variant="outline" onClick={fetchRegisterSession} disabled={loading || saving || closing} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={handleSave} disabled={!canEdit || saving || closing} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handleCloseRegister} disabled={!canClose} className="w-full sm:ml-auto sm:w-auto">
              {sessionClosed ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Closed
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  {closing ? 'Closing...' : 'Close Register'}
                </>
              )}
            </Button>
          </div>
        )}
        {!loading && !session && (
          <div className="flex flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:flex-wrap sm:px-6">
            <Button variant="outline" onClick={fetchRegisterSession} disabled={loading || opening} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={handleOpenSession} disabled={!canOpen} className="w-full sm:ml-auto sm:w-auto">
              <PlayCircle className="mr-2 h-4 w-4" />
              {opening ? 'Opening...' : 'Open Register'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
