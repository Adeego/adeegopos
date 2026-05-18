import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeftRight, Loader2 } from 'lucide-react';

import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TransactionReconciliationDialog({
  transaction,
  mode = 'reverse',
  trigger,
  onSuccess,
}) {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const staff = useStaffStore((state) => state.staff);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replacementTransaction, setReplacementTransaction] = useState({
    description: '',
    amount: '',
    transactionCost: '',
    date: '',
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setNotes('');
    setPreview(null);
    setReplacementTransaction({
      description: transaction?.description || '',
      amount: transaction?.amount || '',
      transactionCost: transaction?.transactionCost || '',
      date: transaction?.date ? new Date(transaction.date).toISOString().split('T')[0] : '',
    });
  }, [open, transaction]);

  const buildPayload = () => {
    const payload = {
      _id: `${storeNo}:reconciliation:${uuidv4()}`,
      storeNo,
      caseType: 'transaction_correction',
      sourceType: 'transaction',
      sourceId: transaction._id,
      reasonCode: mode === 'replace' ? 'transaction_replace' : 'transaction_reverse',
      notes,
      initiatedBy: staff,
    };

    if (mode === 'replace') {
      payload.replacementTransaction = {
        description: replacementTransaction.description,
        amount: Number(replacementTransaction.amount) || 0,
        transactionCost: Number(replacementTransaction.transactionCost) || 0,
        date: replacementTransaction.date ? new Date(replacementTransaction.date).toISOString() : new Date().toISOString(),
      };
    }

    return payload;
  };

  const runPreview = async (payload) => {
    setLoadingPreview(true);
    try {
      const result = await window.electronAPI.realmOperation('previewReconciliation', payload);
      if (result.success) {
        setPreview(result.impactPreview);
        return result;
      }

      throw new Error(result.error || 'Failed to preview transaction correction');
    } catch (error) {
      toast({
        title: 'Preview failed',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async () => {
    const payload = buildPayload();
    setSubmitting(true);

    try {
      const previewResult = await runPreview(payload);
      if (!previewResult?.success) {
        return;
      }

      if ((previewResult.impactPreview?.validationErrors || []).length > 0) {
        toast({
          title: 'Validation error',
          description: previewResult.impactPreview.validationErrors.join(', '),
          variant: 'destructive',
        });
        return;
      }

      const result = await window.electronAPI.realmOperation('createReconciliationCase', payload);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create transaction correction case');
      }

      toast({
        title: 'Transaction correction submitted',
        description: 'The correction case is waiting for approval.',
      });

      setOpen(false);
      onSuccess?.(result.reconciliation);
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            {mode === 'replace' ? 'Reverse + Replace' : 'Reverse'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-h-[90vh]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{mode === 'replace' ? 'Reverse and Replace Transaction' : 'Reverse Transaction'}</DialogTitle>
          <DialogDescription>
            Create an auditable correction case for transaction {transaction?._id}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-9rem)]">
          <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary">{transaction?.status || 'posted'}</Badge>
                  <Badge variant="outline">{transaction?.transType}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description</span>
                    <span>{transaction?.description}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span>KES {Number(transaction?.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{transaction?.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {mode === 'replace' && (
                <div className="space-y-4 rounded-md border p-4">
                  <div className="font-medium">Replacement Transaction</div>
                  <div className="space-y-2">
                    <Label htmlFor="replacement-description">Description</Label>
                    <Input
                      id="replacement-description"
                      value={replacementTransaction.description}
                      onChange={(event) => setReplacementTransaction((current) => ({
                        ...current,
                        description: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="replacement-amount">Amount</Label>
                      <Input
                        id="replacement-amount"
                        type="number"
                        min="0"
                        value={replacementTransaction.amount}
                        onChange={(event) => setReplacementTransaction((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="replacement-cost">Txn Cost</Label>
                      <Input
                        id="replacement-cost"
                        type="number"
                        min="0"
                        value={replacementTransaction.transactionCost}
                        onChange={(event) => setReplacementTransaction((current) => ({
                          ...current,
                          transactionCost: event.target.value,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="replacement-date">Date</Label>
                      <Input
                        id="replacement-date"
                        type="date"
                        value={replacementTransaction.date}
                        onChange={(event) => setReplacementTransaction((current) => ({
                          ...current,
                          date: event.target.value,
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="transaction-notes">Notes</Label>
                <Textarea
                  id="transaction-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add internal notes for the approver"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-md border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Impact Preview</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => runPreview(buildPayload())} disabled={loadingPreview}>
                  {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview'}
                </Button>
              </div>

              {preview ? (
                <div className="space-y-3 text-sm">
                  {(preview.validationErrors || []).length > 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                      {preview.validationErrors.join(', ')}
                    </div>
                  )}

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Customer deltas</div>
                      <div className="text-lg font-semibold">{preview.summary?.customerDeltaCount || 0}</div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Account deltas</div>
                      <div className="text-lg font-semibold">{preview.summary?.accountDeltaCount || 0}</div>
                    </div>
                  </div>

                  <ScrollArea className="h-48 rounded-md border bg-background p-3">
                    <div className="space-y-3">
                      {(preview.customerDeltas || []).map((entry, index) => (
                        <div key={`customer-${index}`} className="text-xs">
                          <div className="font-medium">Customer</div>
                          <div className="text-muted-foreground">
                            {entry.delta > 0 ? '+' : ''}{entry.delta} for {entry.entityId}
                          </div>
                        </div>
                      ))}
                      {(preview.accountDeltas || []).map((entry, index) => (
                        <div key={`account-${index}`} className="text-xs">
                          <div className="font-medium">Account</div>
                          <div className="text-muted-foreground">
                            {entry.delta > 0 ? '+' : ''}{entry.delta} for {entry.entityId}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Run preview to see the balance impact before submitting the correction case.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit For Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
