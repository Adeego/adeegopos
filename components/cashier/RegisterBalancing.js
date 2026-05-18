'use client'

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Calculator, CheckCircle2, Clock, Lock, RefreshCw, Save, Smartphone, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

export default function RegisterBalancing({ defaultOpen = false }) {
  const { toast } = useToast();
  const staff = useStaffStore((state) => state.staff);
  const store = useWsinfoStore((state) => state.wsinfo);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [session, setSession] = useState(null);
  const [countedCash, setCountedCash] = useState('0');
  const [countedMpesa, setCountedMpesa] = useState('0');
  const [transferAmount, setTransferAmount] = useState('0');
  const [transferCost, setTransferCost] = useState('0');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  const canManageCashier = can(staff, 'cashier:manage');
  const storeNo = store?.storeNo || '';
  const businessDate = getTodayBusinessDate();

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);

  const syncLocalState = useCallback((nextSession) => {
    setSession(nextSession);
    setCountedCash(String(nextSession?.countedBalances?.cash ?? 0));
    setCountedMpesa(String(nextSession?.countedBalances?.mpesa ?? 0));
    setTransferAmount(String(nextSession?.transfer?.amount ?? 0));
    setTransferCost(String(nextSession?.transfer?.transactionCost ?? 0));
    setDestinationAccountId(nextSession?.transfer?.destinationAccountId || '');
    setTransferDescription(nextSession?.transfer?.description || `Register close transfer for ${nextSession?.businessDate || businessDate}`);
  }, [businessDate]);

  const fetchRegisterSession = useCallback(async () => {
    if (!storeNo) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.realmOperation('getRegisterSession', storeNo, businessDate);
      if (!result.success) {
        throw new Error(result.error || 'Failed to load register session');
      }

      syncLocalState(result.session);
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

  const transferAmountValue = toInputNumber(transferAmount);
  const transferCostValue = toInputNumber(transferCost);
  const remainingDrawerCash = Number((liveCountedTotals.cash - transferAmountValue - transferCostValue).toFixed(2));
  const setupError = session?.setupError || '';
  const sessionClosed = session?.status === 'closed';
  const canEdit = canManageCashier && !setupError && !sessionClosed;
  const canClose = canEdit && !closing && remainingDrawerCash >= 0 && ((transferAmountValue === 0 && transferCostValue === 0) || destinationAccountId);

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
        businessDate,
        countedBalances,
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
        description: setupError || 'Complete the transfer details and ensure the remaining drawer cash is not negative.',
        variant: 'destructive',
      });
      return;
    }

    setClosing(true);
    try {
      const result = await window.electronAPI.realmOperation('closeRegisterSession', {
        storeNo,
        businessDate,
        countedBalances,
        transfer: {
          destinationAccountId,
          amount: transferAmountValue,
          transactionCost: transferCostValue,
          description: transferDescription,
        },
      }, staff);

      if (!result.success) {
        throw new Error(result.error || 'Failed to close register');
      }

      syncLocalState(result.session);
      toast({
        title: 'Register Closed',
        description: transferAmountValue > 0
          ? 'Register closed and cash transferred successfully.'
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
            {formatBusinessDate(session?.businessDate || businessDate)}
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

            {!loading && session && (
              <>
                <Card className="border-muted bg-muted/30 shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium">Session Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 p-4 pt-0 text-sm sm:grid-cols-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-semibold">{formatDateTime(session.createdAt)}</span>
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
                    <CardTitle className="text-sm font-medium">Cash Close Transfer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Transfer Amount</Label>
                        <Input
                          type="number"
                          value={transferAmount}
                          onChange={(event) => setTransferAmount(event.target.value)}
                          disabled={!canEdit}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Transfer Cost</Label>
                        <Input
                          type="number"
                          value={transferCost}
                          onChange={(event) => setTransferCost(event.target.value)}
                          disabled={!canEdit}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Destination Account</Label>
                      <Select
                        value={destinationAccountId}
                        onValueChange={setDestinationAccountId}
                        disabled={!canEdit || session.availableTransferAccounts?.length === 0}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {(session.availableTransferAccounts || []).map((account) => (
                            <SelectItem key={account._id} value={account._id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Transfer Description</Label>
                      <Input
                        value={transferDescription}
                        onChange={(event) => setTransferDescription(event.target.value)}
                        disabled={!canEdit}
                        className="mt-1"
                      />
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Remaining Drawer Cash</span>
                        <span className={`font-semibold ${remainingDrawerCash < 0 ? 'text-red-600' : ''}`}>
                          {toCurrency(remainingDrawerCash)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-muted-foreground">Transfer Cost Accounted</span>
                        <span className="font-semibold">{toCurrency(transferCostValue)}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        The remaining drawer cash becomes the next day&apos;s opening cash balance after transfer amount and transfer cost are deducted.
                      </p>
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
                          <span className="text-muted-foreground">Drawer Cash After Close</span>
                          <span className="font-semibold">{toCurrency(session.closeSummary.remainingDrawerCash)}</span>
                        </div>
                      </>
                    )}
                    {session.transfer && (
                      <div className="rounded-lg border bg-muted/40 p-3">
                        <div className="flex items-center gap-2 font-medium">
                          <ArrowRightLeft className="h-4 w-4" />
                          Cash Transfer
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {toCurrency(session.transfer.amount)} moved to {session.transfer.destinationAccountName}
                          {session.transfer.transactionCost > 0 ? ` with ${toCurrency(session.transfer.transactionCost)} transfer cost.` : '.'}
                        </p>
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
      </DialogContent>
    </Dialog>
  );
}
