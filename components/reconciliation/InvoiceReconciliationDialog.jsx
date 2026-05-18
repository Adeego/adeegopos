import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowRightLeft, Loader2 } from 'lucide-react';

import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const VOID_REASONS = [
  { value: 'entry_error', label: 'Entry error' },
  { value: 'duplicate_invoice', label: 'Duplicate invoice' },
  { value: 'supplier_return', label: 'Supplier return' },
];

const ADJUSTMENT_REASONS = [
  { value: 'quantity_correction', label: 'Quantity correction' },
  { value: 'price_correction', label: 'Price correction' },
  { value: 'supplier_correction', label: 'Supplier correction' },
];

function formatCurrency(value) {
  return `KES ${Number(value || 0).toFixed(2)}`;
}

function getLineQuantity(item = {}) {
  return Math.abs(Number(item.quantity) || 0);
}

function getLineBuyPrice(item = {}) {
  return Math.abs(Number(item.buyPrice) || 0);
}

function getLineSubtotal(item = {}) {
  const subtotal = Number(item.subtotal);
  if (Number.isFinite(subtotal)) {
    return Math.abs(subtotal);
  }

  return getLineQuantity(item) * getLineBuyPrice(item);
}

function buildInitialAdjustmentLines(invoice) {
  return (invoice?.items || []).map((item, index) => ({
    lineId: item._id || item.lineId || null,
    lineIndex: index,
    originalQuantity: getLineQuantity(item),
    originalBuyPrice: getLineBuyPrice(item),
    correctedQuantity: getLineQuantity(item),
    correctedBuyPrice: getLineBuyPrice(item),
  }));
}

export default function InvoiceReconciliationDialog({
  invoice,
  mode = 'adjust',
  trigger,
  onSuccess,
}) {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const staff = useStaffStore((state) => state.staff);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [reasonCode, setReasonCode] = useState(mode === 'void' ? 'entry_error' : 'quantity_correction');
  const [adjustmentLines, setAdjustmentLines] = useState(() => buildInitialAdjustmentLines(invoice));
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const caseType = mode === 'void' ? 'invoice_void' : 'invoice_adjustment';
  const isVoided = invoice?.status === 'voided';
  const reasons = mode === 'void' ? VOID_REASONS : ADJUSTMENT_REASONS;

  useEffect(() => {
    if (!open) {
      return;
    }

    setNotes('');
    setReasonCode(mode === 'void' ? 'entry_error' : 'quantity_correction');
    setAdjustmentLines(buildInitialAdjustmentLines(invoice));
    setPreview(null);
  }, [open, invoice, mode]);

  const changedAdjustmentLines = useMemo(
    () => adjustmentLines.filter((line) => (
      Number(line.correctedQuantity) !== Number(line.originalQuantity) ||
      Number(line.correctedBuyPrice) !== Number(line.originalBuyPrice)
    )),
    [adjustmentLines]
  );

  const buildPayload = () => {
    const payload = {
      _id: `${storeNo || invoice?.storeNo || invoice?.store}:reconciliation:${uuidv4()}`,
      storeNo: storeNo || invoice?.storeNo || invoice?.store,
      caseType,
      sourceType: 'invoice',
      sourceId: invoice._id,
      reasonCode,
      notes,
      initiatedBy: staff,
    };

    if (caseType === 'invoice_adjustment') {
      payload.adjustmentLines = changedAdjustmentLines.map((line) => ({
        lineId: line.lineId,
        lineIndex: line.lineIndex,
        correctedQuantity: Number(line.correctedQuantity) || 0,
        correctedBuyPrice: Number(line.correctedBuyPrice) || 0,
      }));
    }

    return payload;
  };

  const updateLine = (lineIndex, key, value) => {
    setAdjustmentLines((current) => current.map((line) => (
      line.lineIndex === lineIndex
        ? { ...line, [key]: Math.max(0, Number(value) || 0) }
        : line
    )));
    setPreview(null);
  };

  const runPreview = async (payload) => {
    setLoadingPreview(true);
    try {
      const result = await window.electronAPI.realmOperation('previewReconciliation', payload);
      if (result.success) {
        setPreview(result.impactPreview);
        return result;
      }

      throw new Error(result.error || 'Failed to preview invoice reconciliation');
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
        throw new Error(result.error || 'Failed to create invoice reconciliation case');
      }

      toast({
        title: 'Invoice reconciliation submitted',
        description: 'The case was created and is waiting for approval.',
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
          <Button variant="outline" className="gap-2" disabled={isVoided}>
            <ArrowRightLeft className="h-4 w-4" />
            {mode === 'void' ? 'Void Invoice' : 'Adjust Invoice'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </span>
            {mode === 'void' ? 'Void Supplier Invoice' : 'Adjust Supplier Invoice'}
          </DialogTitle>
          <DialogDescription>
            Create an approval-gated correction for invoice {invoice?._id}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-9.5rem)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-4">
              <div className="rounded-md border bg-background p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={reasonCode} onValueChange={setReasonCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {reasons.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3 text-sm">
                    <div className="text-muted-foreground">Invoice status</div>
                    <Badge className="mt-2" variant={isVoided ? 'destructive' : invoice?.status === 'adjusted' ? 'secondary' : 'outline'}>
                      {invoice?.status || 'posted'}
                    </Badge>
                  </div>
                </div>
              </div>

              {mode === 'adjust' ? (
                <div className="space-y-3 rounded-md border bg-background p-4">
                  <div>
                    <Label>Invoice Lines</Label>
                    <p className="text-xs text-muted-foreground">Enter the corrected purchase quantity and buy price.</p>
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    <Table className="min-w-[760px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Original Qty</TableHead>
                          <TableHead>Correct Qty</TableHead>
                          <TableHead>Original Price</TableHead>
                          <TableHead>Correct Price</TableHead>
                          <TableHead>Correct Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(invoice?.items || []).map((item, index) => {
                          const selectedLine = adjustmentLines.find((line) => line.lineIndex === index);
                          return (
                            <TableRow key={item._id || `${invoice._id}-${index}`}>
                              <TableCell>
                                <div className="font-medium">{item.productName || item.name || 'Invoice item'}</div>
                                <div className="text-xs text-muted-foreground">{formatCurrency(getLineSubtotal(item))}</div>
                              </TableCell>
                              <TableCell>{getLineQuantity(item)}</TableCell>
                              <TableCell className="w-28">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={selectedLine?.correctedQuantity ?? 0}
                                  onChange={(event) => updateLine(index, 'correctedQuantity', event.target.value)}
                                />
                              </TableCell>
                              <TableCell>{formatCurrency(getLineBuyPrice(item))}</TableCell>
                              <TableCell className="w-32">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={selectedLine?.correctedBuyPrice ?? 0}
                                  onChange={(event) => updateLine(index, 'correctedBuyPrice', event.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                {formatCurrency((Number(selectedLine?.correctedQuantity) || 0) * (Number(selectedLine?.correctedBuyPrice) || 0))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Voiding an invoice reverses its stock and supplier payable impact, then marks the invoice as voided.
                </div>
              )}

              <div className="space-y-2 rounded-md border bg-background p-4">
                <Label htmlFor="invoice-reconciliation-notes">Notes</Label>
                <Textarea
                  id="invoice-reconciliation-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add internal notes for the approver"
                  className="min-h-24"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-md border bg-muted/20 p-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-md border bg-background p-4">
                <div className="text-sm font-medium">Invoice Summary</div>
                <Separator className="my-4" />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-medium">{formatCurrency(invoice?.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Line Items</span>
                    <span className="font-medium">{invoice?.items?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Changed Lines</span>
                    <span className="font-medium">{mode === 'adjust' ? changedAdjustmentLines.length : invoice?.items?.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-md border bg-background p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Impact Preview</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => runPreview(buildPayload())} disabled={loadingPreview}>
                    {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                    Preview
                  </Button>
                </div>

                {preview ? (
                  <div className="space-y-3 text-sm">
                    {(preview.validationErrors || []).length > 0 && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                        {preview.validationErrors.join(', ')}
                      </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Stock movements</div>
                        <div className="text-lg font-semibold">{preview.summary?.stockDeltaCount || 0}</div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Supplier delta</div>
                        <div className="text-lg font-semibold">{formatCurrency(preview.summary?.supplierDeltaTotal || 0)}</div>
                      </div>
                    </div>

                    <ScrollArea className="h-48 rounded-md border bg-muted/20 p-3">
                      <div className="space-y-3">
                        {(preview.stockDeltas || []).map((entry, index) => (
                          <div key={`stock-${index}`} className="text-xs">
                            <div className="font-medium">Stock: {entry.productName || entry.productId}</div>
                            <div className="text-muted-foreground">
                              {entry.quantityDelta > 0 ? '+' : ''}{entry.quantityDelta}
                            </div>
                          </div>
                        ))}
                        {(preview.supplierDeltas || []).map((entry, index) => (
                          <div key={`supplier-${index}`} className="text-xs">
                            <div className="font-medium">Supplier payable</div>
                            <div className="text-muted-foreground">
                              {entry.delta > 0 ? '+' : ''}{formatCurrency(entry.delta)} for {entry.entityId}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Run preview to see stock and supplier payable impact before submitting.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || isVoided}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit For Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
