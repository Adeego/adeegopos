import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowRightLeft, Loader2, Search, Trash2 } from 'lucide-react';

import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const CASE_OPTIONS = [
  { value: 'item_return', label: 'Return Items' },
  { value: 'item_exchange', label: 'Exchange Items' },
  { value: 'wrong_customer', label: 'Wrong Customer' },
  { value: 'sale_void', label: 'Void Sale' },
];

const CASE_REASON_DEFAULTS = {
  item_return: 'customer_return',
  item_exchange: 'customer_exchange',
  wrong_customer: 'wrong_customer',
  sale_void: 'entry_error',
};

const CASE_REASON_OPTIONS = {
  item_return: [
    { value: 'customer_return', label: 'Customer return' },
    { value: 'damaged_item', label: 'Damaged item' },
    { value: 'entry_error', label: 'Entry error' },
  ],
  item_exchange: [
    { value: 'customer_exchange', label: 'Customer exchange' },
    { value: 'wrong_item', label: 'Wrong item sold' },
    { value: 'damaged_item', label: 'Damaged item' },
  ],
  wrong_customer: [
    { value: 'wrong_customer', label: 'Wrong customer attached' },
    { value: 'entry_error', label: 'Entry error' },
  ],
  sale_void: [
    { value: 'entry_error', label: 'Entry error' },
    { value: 'duplicate_sale', label: 'Duplicate sale' },
    { value: 'cancelled_before_fulfillment', label: 'Cancelled before fulfillment' },
  ],
};

function getRemainingQty(sale, item) {
  const map = sale?.remainingReturnableByLine || sale?.returnedQuantitiesByLine || {};
  const rawValue = map[item._id];
  if (sale?.remainingReturnableByLine && rawValue !== undefined) {
    return Number(rawValue) || 0;
  }

  const returned = Number(rawValue) || 0;
  return Math.max(0, (Number(item.quantity) || 0) - returned);
}

function formatCurrency(value) {
  return `KES ${Number(value || 0).toFixed(2)}`;
}

function buildInitialReturnLines(sale) {
  return (sale?.items || []).map((item) => ({
    saleLineId: item._id,
    quantity: 0,
    condition: 'sellable',
  }));
}

function normalizeVariantResult(product) {
  return {
    variantId: product._id,
    productId: product.productId || product._id,
    productName: product.productName || product.name,
    variantName: product.variantName || product.name,
    name: `${product.productName || product.name} ${product.variantName || ''}`.trim(),
    buyPrice: Number(product.buyPrice) || 0,
    unitPrice: Number(product.unitPrice) || 0,
    quantity: 1,
    discount: 0,
    conversionFactor: Number(product.conversionFactor) || 1,
    availableStock: Number(product.stock) || 0,
  };
}

function ReplacementItemsSection({
  storeNo,
  replacementItems,
  setReplacementItems,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!storeNo) {
      return;
    }

    const timeout = setTimeout(async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const result = await window.electronAPI.searchVariants(searchTerm, storeNo);
        if (result.success) {
          setSearchResults((result.products || []).map(normalizeVariantResult));
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching replacement items:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, storeNo]);

  const addReplacementItem = (variant) => {
    setReplacementItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.productId === variant.productId && item.variantId === variant.variantId
      );

      if (existingIndex === -1) {
        return [...current, variant];
      }

      return current.map((item, index) => (
        index === existingIndex
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    });
  };

  const updateReplacementItem = (variantId, key, value) => {
    setReplacementItems((current) => current.map((item) => {
      if (item.variantId !== variantId) {
        return item;
      }

      const nextValue = key === 'quantity'
        ? Math.max(1, Number(value) || 1)
        : Math.max(0, Number(value) || 0);

      return { ...item, [key]: nextValue };
    }));
  };

  const removeReplacementItem = (variantId) => {
    setReplacementItems((current) => current.filter((item) => item.variantId !== variantId));
  };

  return (
    <div className="space-y-4 rounded-md border bg-background p-4">
      <div className="space-y-2">
        <Label htmlFor="replacement-search">Replacement Items</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="replacement-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search replacement item..."
            className="pl-9"
          />
        </div>
      </div>

      {searching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching items...
        </div>
      )}

      {searchResults.length > 0 && (
        <ScrollArea className="h-36 rounded-md border bg-muted/20">
          <div className="space-y-2 p-3">
            {searchResults.map((product) => (
              <button
                key={`${product.productId}:${product.variantId}`}
                type="button"
                onClick={() => addReplacementItem(product)}
                className="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock: {Math.floor(product.availableStock / (product.conversionFactor || 1))} | {formatCurrency(product.unitPrice)}
                  </div>
                </div>
                <Badge variant="secondary">Add</Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {replacementItems.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replacementItems.map((item) => (
                <TableRow key={item.variantId}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="w-24">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) => updateReplacementItem(item.variantId, 'quantity', event.target.value)}
                    />
                  </TableCell>
                  <TableCell className="w-28">
                    <Input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(event) => updateReplacementItem(item.variantId, 'unitPrice', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeReplacementItem(item.variantId)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CustomerSearchSection({ storeNo, selectedCustomerId, setSelectedCustomerId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!storeNo) {
      return;
    }

    const timeout = setTimeout(async () => {
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }

      try {
        const result = await window.electronAPI.searchCustomers(searchTerm, storeNo);
        if (result.success) {
          setResults(result.customers || []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Error searching customers:', error);
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, storeNo]);

  return (
    <div className="space-y-3 rounded-md border bg-background p-4">
      <div className="space-y-2">
        <Label htmlFor="correct-customer">Correct Customer</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="correct-customer"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by customer name or phone"
            className="pl-9"
          />
        </div>
      </div>

      {results.length > 0 && (
        <ScrollArea className="h-40 rounded-md border bg-muted/20">
          <div className="space-y-2 p-3">
            {results.map((customer) => {
              const selected = customer._id === selectedCustomerId;
              return (
                <button
                  key={customer._id}
                  type="button"
                  onClick={() => setSelectedCustomerId(customer._id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.phoneNumber || 'No phone number'}</div>
                  </div>
                  {selected && <Badge>Selected</Badge>}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default function SaleReconciliationDialog({ sale, trigger, onSuccess }) {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const staff = useStaffStore((state) => state.staff);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [caseType, setCaseType] = useState('item_return');
  const [reasonCode, setReasonCode] = useState(CASE_REASON_DEFAULTS.item_return);
  const [notes, setNotes] = useState('');
  const [returnLines, setReturnLines] = useState(() => buildInitialReturnLines(sale));
  const [replacementItems, setReplacementItems] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCaseType('item_return');
    setReasonCode(CASE_REASON_DEFAULTS.item_return);
    setNotes('');
    setReturnLines(buildInitialReturnLines(sale));
    setReplacementItems([]);
    setSelectedCustomerId('');
    setPreview(null);
  }, [open, sale]);

  useEffect(() => {
    setReasonCode(CASE_REASON_DEFAULTS[caseType]);
    setPreview(null);
  }, [caseType]);

  const returnableItems = useMemo(() => (sale?.items || []).filter((item) => getRemainingQty(sale, item) > 0), [sale]);

  const selectedReturnLines = useMemo(() => returnLines.filter((line) => Number(line.quantity) > 0), [returnLines]);

  const buildPayload = () => {
    const payload = {
      _id: `${storeNo}:reconciliation:${uuidv4()}`,
      storeNo,
      caseType,
      sourceType: 'sale',
      sourceId: sale._id,
      reasonCode,
      notes,
      initiatedBy: staff,
    };

    if (caseType === 'item_return' || caseType === 'item_exchange') {
      payload.returnLines = selectedReturnLines.map((line) => ({
        saleLineId: line.saleLineId,
        quantity: Number(line.quantity) || 0,
        condition: line.condition || 'sellable',
      }));
    }

    if (caseType === 'item_exchange') {
      payload.replacementItems = replacementItems;
    }

    if (caseType === 'wrong_customer') {
      payload.newCustomerId = selectedCustomerId;
    }

    return payload;
  };

  const handleReturnLineChange = (saleLineId, key, value) => {
    setReturnLines((current) => current.map((line) => {
      if (line.saleLineId !== saleLineId) {
        return line;
      }

      return {
        ...line,
        [key]: key === 'quantity' ? Math.max(0, Number(value) || 0) : value,
      };
    }));
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

      throw new Error(result.error || 'Failed to preview reconciliation');
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
        throw new Error(result.error || 'Failed to create reconciliation case');
      }

      toast({
        title: 'Reconciliation submitted',
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

  const disableCaseType = caseType === 'sale_void' && sale?.status === 'voided';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Reconcile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </span>
            Reconcile Sale
          </DialogTitle>
          <DialogDescription>
            Create a non-destructive correction for sale {sale?._id}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-9.5rem)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-4">
              <div className="rounded-md border bg-background p-4">
                <div className="mb-4">
                  <div className="text-sm font-medium">Correction Details</div>
                  <p className="text-xs text-muted-foreground">Choose the case type and reason for the approver.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Case Type</Label>
                    <Select value={caseType} onValueChange={setCaseType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select case type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CASE_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={option.value === 'sale_void' && sale?.status === 'voided'}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={reasonCode} onValueChange={setReasonCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {(CASE_REASON_OPTIONS[caseType] || []).map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {(caseType === 'item_return' || caseType === 'item_exchange') && (
                <div className="space-y-3 rounded-md border bg-background p-4">
                  <div>
                    <Label>Return Lines</Label>
                    <p className="text-xs text-muted-foreground">Enter quantities for the sale lines being returned.</p>
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    <Table className="min-w-[680px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Remaining</TableHead>
                          <TableHead>Return Qty</TableHead>
                          <TableHead>Condition</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnableItems.length > 0 ? returnableItems.map((item) => {
                          const selectedLine = returnLines.find((line) => line.saleLineId === item._id) || {
                            saleLineId: item._id,
                            quantity: 0,
                            condition: 'sellable',
                          };
                          return (
                            <TableRow key={item._id}>
                              <TableCell>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(Math.abs(Number(item.subtotal || 0)))}
                                </div>
                              </TableCell>
                              <TableCell>{getRemainingQty(sale, item)}</TableCell>
                              <TableCell className="w-28">
                                <Input
                                  type="number"
                                  min="0"
                                  max={getRemainingQty(sale, item)}
                                  value={selectedLine.quantity}
                                  onChange={(event) => handleReturnLineChange(item._id, 'quantity', event.target.value)}
                                />
                              </TableCell>
                              <TableCell className="w-40">
                                <Select
                                  value={selectedLine.condition}
                                  onValueChange={(value) => handleReturnLineChange(item._id, 'condition', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sellable">Sellable</SelectItem>
                                    <SelectItem value="damaged">Damaged</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        }) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No returnable items are available for this sale.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {caseType === 'item_exchange' && (
                <ReplacementItemsSection
                  storeNo={storeNo}
                  replacementItems={replacementItems}
                  setReplacementItems={setReplacementItems}
                />
              )}

              {caseType === 'wrong_customer' && (
                <CustomerSearchSection
                  storeNo={storeNo}
                  selectedCustomerId={selectedCustomerId}
                  setSelectedCustomerId={setSelectedCustomerId}
                />
              )}

              {caseType === 'sale_void' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Voiding a sale will reverse stock and balance impact for the full sale and mark the original sale as voided.
                </div>
              )}

              <div className="space-y-2 rounded-md border bg-background p-4">
                <Label htmlFor="reconciliation-notes">Notes</Label>
                <Textarea
                  id="reconciliation-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add internal notes for the approver"
                  className="min-h-24"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-md border bg-muted/20 p-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-md border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Sale Summary</div>
                    <div className="mt-1 text-xs text-muted-foreground">Current posted sale state</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant={sale?.status === 'voided' ? 'destructive' : 'secondary'}>
                      {sale?.status || 'posted'}
                    </Badge>
                    <Badge variant="outline">{sale?.paymentMethod}</Badge>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Net Amount</span>
                    <span className="font-medium">{formatCurrency(sale?.netTotalAmount ?? sale?.totalAmount ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="min-w-0 truncate pl-3 font-medium">{sale?.currentCustomerId || sale?.customerId || 'Walk-in'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium">{sale?.totalItems ?? sale?.items?.length ?? 0}</span>
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

                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Stock movements</div>
                        <div className="text-lg font-semibold">{preview.summary?.stockDeltaCount || 0}</div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Customer deltas</div>
                        <div className="text-lg font-semibold">{preview.summary?.customerDeltaCount || 0}</div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Account deltas</div>
                        <div className="text-lg font-semibold">{preview.summary?.accountDeltaCount || 0}</div>
                      </div>
                    </div>

                    <ScrollArea className="h-44 rounded-md border bg-muted/20 p-3">
                      <div className="space-y-3">
                        {(preview.stockDeltas || []).map((entry, index) => (
                          <div key={`stock-${index}`} className="text-xs">
                            <div className="font-medium">Stock: {entry.productName || entry.productId}</div>
                            <div className="text-muted-foreground">
                              {entry.quantityDelta > 0 ? '+' : ''}{entry.quantityDelta} ({entry.condition})
                            </div>
                          </div>
                        ))}
                        {(preview.customerDeltas || []).map((entry, index) => (
                          <div key={`customer-${index}`} className="text-xs">
                            <div className="font-medium">Customer balance</div>
                            <div className="text-muted-foreground">
                              {entry.delta > 0 ? '+' : ''}{entry.delta} for {entry.entityId}
                            </div>
                          </div>
                        ))}
                        {(preview.accountDeltas || []).map((entry, index) => (
                          <div key={`account-${index}`} className="text-xs">
                            <div className="font-medium">Account balance</div>
                            <div className="text-muted-foreground">
                              {entry.delta > 0 ? '+' : ''}{entry.delta} for {entry.entityId}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Run preview to see stock, customer, and account impact before submitting the case.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t bg-background px-6 py-4 sm:space-x-0">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="gap-2" onClick={handleSubmit} disabled={submitting || disableCaseType}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit For Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
