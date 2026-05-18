import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  MapPin,
  PencilLine,
  Phone,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import InvoiceReconciliationDialog from '@/components/reconciliation/InvoiceReconciliationDialog';
import ReconciliationHistory from '@/components/reconciliation/ReconciliationHistory';
import useWsinfoStore from '@/stores/wsinfo';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES',
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRef = (value, prefix) => {
  const raw = String(value || '');
  const lastPart = raw.includes(':') ? raw.split(':').pop() : raw;

  if (!lastPart) {
    return 'N/A';
  }

  return `${prefix}-${lastPart.slice(0, 8).toUpperCase()}`;
};

const getInvoiceRef = (invoice) => formatRef(invoice?._id, 'INV');
const getTransactionRef = (transaction) => formatRef(transaction?._id, 'PAY');

const getLineItemsCount = (invoice) => {
  if (typeof invoice?.totalItems === 'number') {
    return invoice.totalItems;
  }

  return (invoice?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
};

const getLedgerBadge = (kind) => {
  if (kind === 'invoice') {
    return { label: 'Invoice', variant: 'warning' };
  }

  if (kind === 'payment') {
    return { label: 'Payment', variant: 'default' };
  }

  return { label: 'Adjustment', variant: 'secondary' };
};

const getPaymentSourceLabel = (transaction) => {
  if (transaction.source === 'account') {
    return transaction.fromEntity?.name || 'Business Account';
  }

  if (transaction.destination === 'account') {
    return transaction.toEntity?.name || 'Business Account';
  }

  return transaction.fromEntity?.name || transaction.toEntity?.name || 'Unknown source';
};

const getBalanceTone = (balance) => {
  if ((Number(balance) || 0) > 0) {
    return {
      label: 'Outstanding payable',
      className: 'border-amber-200 bg-amber-50 text-amber-900',
    };
  }

  return {
    label: 'Settled',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
};

export default function SupplierDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const store = useWsinfoStore((state) => state.wsinfo);

  const [storeNo, setStoreNo] = useState('');
  const [statement, setStatement] = useState(null);
  const [editedSupplier, setEditedSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedReconciliations, setSelectedReconciliations] = useState([]);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);

  const fetchSupplierStatement = useCallback(async () => {
    if (!id || !storeNo) return;

    setIsLoading(true);

    try {
      const result = await window.electronAPI.realmOperation('getSupplierStatement', id, storeNo);

      if (result.success) {
        setStatement(result);
      } else {
        console.error('Failed to fetch supplier statement:', result.error);
        toast({
          title: 'Unable to load supplier',
          description: result.error || 'Failed to fetch supplier statement.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching supplier statement:', error);
      toast({
        title: 'Unable to load supplier',
        description: 'An error occurred while fetching supplier details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, storeNo, toast]);

  useEffect(() => {
    if (store?.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (id && storeNo) {
      fetchSupplierStatement();
    }
  }, [id, storeNo, fetchSupplierStatement]);

  useEffect(() => {
    if (statement?.supplier) {
      setEditedSupplier({
        ...statement.supplier,
        balance: Number(statement.supplier.balance) || 0,
      });
    }
  }, [statement]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setEditedSupplier((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCategoryChange = (value) => {
    setEditedSupplier((current) => ({
      ...current,
      category: value,
    }));
  };

  const handleSave = async () => {
    if (!editedSupplier || !storeNo) return;

    setIsSaving(true);

    try {
      const result = await window.electronAPI.realmOperation('updateSupplier', {
        ...editedSupplier,
        balance: Number(editedSupplier.balance) || 0,
        updatedAt: new Date().toISOString(),
        storeNo,
      });

      if (result.success) {
        setIsEditing(false);
        toast({
          title: 'Supplier updated',
          description: 'Supplier profile changes were saved successfully.',
        });
        await fetchSupplierStatement();
      } else {
        console.error('Failed to update supplier:', result.error);
        toast({
          title: 'Update failed',
          description: result.error || 'Failed to update supplier details.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: 'Update failed',
        description: 'An error occurred while updating supplier details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!storeNo) return;

    const confirmed = window.confirm('Are you sure you want to archive this supplier?');
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const result = await window.electronAPI.realmOperation('archiveSupplier', id, storeNo);

      if (result.success) {
        toast({
          title: 'Supplier archived',
          description: 'The supplier has been archived successfully.',
        });
        router.push('/supplier');
      } else {
        console.error('Failed to archive supplier:', result.error);
        toast({
          title: 'Archive failed',
          description: result.error || 'Failed to archive supplier.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error archiving supplier:', error);
      toast({
        title: 'Archive failed',
        description: 'An error occurred while archiving the supplier.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchInvoiceReconciliations = async (invoiceId) => {
    if (!invoiceId || !storeNo) {
      setSelectedReconciliations([]);
      return;
    }

    try {
      const result = await window.electronAPI.realmOperation('getReconciliationBySource', 'invoice', invoiceId, storeNo);
      if (result.success) {
        setSelectedReconciliations(result.reconciliations || []);
      } else {
        console.error('Failed to fetch invoice reconciliations:', result.error);
        setSelectedReconciliations([]);
      }
    } catch (error) {
      console.error('Error fetching invoice reconciliations:', error);
      setSelectedReconciliations([]);
    }
  };

  const openInvoiceDialog = (invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDialogOpen(true);
    fetchInvoiceReconciliations(invoice._id);
  };

  const supplier = statement?.supplier || null;
  const invoices = useMemo(() => statement?.invoices || [], [statement]);
  const payments = useMemo(() => statement?.payments || [], [statement]);
  const ledger = useMemo(() => statement?.ledger || [], [statement]);
  const summary = statement?.summary || {
    currentBalance: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalAdjustments: 0,
    invoiceCount: 0,
    paymentCount: 0,
    averageInvoiceValue: 0,
    settledRatio: 0,
    lastInvoiceAt: null,
    lastPaymentAt: null,
  };

  const recentInvoices = useMemo(() => invoices.slice(0, 5), [invoices]);
  const recentPayments = useMemo(() => payments.slice(0, 5), [payments]);
  const ledgerRows = useMemo(
    () => [...ledger].sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)),
    [ledger]
  );

  if (isLoading && !supplier) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
          <p className="text-sm text-muted-foreground">Loading supplier finance view...</p>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Supplier not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load this supplier profile.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/supplier">Back to suppliers</Link>
        </Button>
      </div>
    );
  }

  const balanceTone = getBalanceTone(summary.currentBalance);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <Card className="overflow-hidden border-0 shadow-xl">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 text-white">
          <CardContent className="p-0">
            <div className="grid gap-6 p-6 lg:grid-cols-[1.6fr_0.8fr] lg:p-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/20" variant="outline">
                        Supplier Profile
                      </Badge>
                      <Badge className={summary.currentBalance > 0 ? 'bg-amber-400 text-slate-900' : 'bg-emerald-400 text-slate-950'}>
                        {balanceTone.label}
                      </Badge>
                    </div>
                    <div>
                      <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{supplier.name}</h1>
                      <p className="mt-2 max-w-2xl text-sm text-slate-200">
                        Full supplier insight with invoice history, payment activity, and a running payable ledger.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      variant="outline"
                      onClick={() => setIsEditing((current) => !current)}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      {isEditing ? 'Close Edit' : 'Edit Supplier'}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isDeleting ? 'Archiving...' : 'Archive'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-emerald-300" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Phone</p>
                        <p className="mt-1 text-sm font-medium text-white">{supplier.phoneNumber || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-emerald-300" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Address</p>
                        <p className="mt-1 text-sm font-medium text-white">{supplier.address || 'No address recorded'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-emerald-300" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Created</p>
                        <p className="mt-1 text-sm font-medium text-white">{formatDate(supplier.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Current Balance</p>
                <div className="mt-3 flex items-end gap-3">
                  <h2 className="text-4xl font-semibold">{formatCurrency(summary.currentBalance)}</h2>
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  {summary.currentBalance > 0
                    ? 'This is the outstanding amount currently owed to the supplier.'
                    : 'This supplier is currently settled based on recorded invoices and payments.'}
                </p>

                <Separator className="my-5 bg-white/10" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Settlement progress</span>
                    <span className="font-medium text-white">{summary.settledRatio}%</span>
                  </div>
                  <Progress className="h-2 bg-white/10" value={summary.settledRatio} />
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Last invoice</p>
                      <p className="mt-1 text-sm text-white">{formatDate(summary.lastInvoiceAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Last payment</p>
                      <p className="mt-1 text-sm text-white">{formatDate(summary.lastPaymentAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Invoiced</CardDescription>
              <Receipt className="h-4 w-4 text-slate-500" />
            </div>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalInvoiced)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{summary.invoiceCount} invoices recorded</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Paid</CardDescription>
              <Wallet className="h-4 w-4 text-slate-500" />
            </div>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalPaid)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{summary.paymentCount} payment entries posted</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Average Invoice</CardDescription>
              <FileText className="h-4 w-4 text-slate-500" />
            </div>
            <CardTitle className="text-2xl">{formatCurrency(summary.averageInvoiceValue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Average supplier invoice value</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Adjustments</CardDescription>
              <ArrowUpRight className="h-4 w-4 text-slate-500" />
            </div>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalAdjustments)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Positive supplier balance adjustments</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-slate-100 p-2 lg:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Supplier Profile</CardTitle>
                <CardDescription>Manage profile details without leaving the supplier statement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {isEditing && editedSupplier ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" name="name" value={editedSupplier.name || ''} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          name="phoneNumber"
                          value={editedSupplier.phoneNumber || ''}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          name="address"
                          value={editedSupplier.address || ''}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="balance">Balance</Label>
                        <Input
                          id="balance"
                          name="balance"
                          type="number"
                          value={editedSupplier.balance}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select value={editedSupplier.category || ''} onValueChange={handleCategoryChange}>
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Electronics">Electronics</SelectItem>
                          <SelectItem value="Groceries">Groceries</SelectItem>
                          <SelectItem value="Clothing">Clothing</SelectItem>
                          <SelectItem value="Furniture">Furniture</SelectItem>
                          <SelectItem value="Stationery">Stationery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditedSupplier({ ...supplier, balance: Number(supplier.balance) || 0 });
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Supplier Name</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{supplier.name}</p>
                      </div>
                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Phone Number</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{supplier.phoneNumber || 'Not provided'}</p>
                      </div>
                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Address</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{supplier.address || 'No address recorded'}</p>
                      </div>
                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Category</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{supplier.category || 'Uncategorized'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Payables Snapshot</CardTitle>
                <CardDescription>Quick operating view for this supplier relationship.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className={`rounded-2xl border p-4 ${balanceTone.className}`}>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-medium">{balanceTone.label}</p>
                      <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.currentBalance)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Settlement ratio</span>
                    <span className="font-medium text-slate-900">{summary.settledRatio}%</span>
                  </div>
                  <Progress value={summary.settledRatio} className="h-2" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Invoice</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(summary.lastInvoiceAt)}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last Payment</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(summary.lastPaymentAt)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    {summary.currentBalance > 0
                      ? `You still owe ${formatCurrency(summary.currentBalance)} to this supplier.`
                      : 'All recorded supplier invoices are currently covered by payments and adjustments.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Recent Invoices</CardTitle>
                <CardDescription>Latest supplier invoice postings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentInvoices.length > 0 ? (
                  recentInvoices.map((invoice) => (
                    <button
                      key={invoice._id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors hover:bg-slate-50"
                      onClick={() => openInvoiceDialog(invoice)}
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{getInvoiceRef(invoice)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(invoice.createdAt)} • {getLineItemsCount(invoice)} items
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">{formatCurrency(invoice.totalAmount)}</p>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No invoices recorded for this supplier yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Recent Payments</CardTitle>
                <CardDescription>Latest supplier-facing transactions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentPayments.length > 0 ? (
                  recentPayments.map((payment) => (
                    <div key={payment._id} className="flex items-center justify-between rounded-2xl border p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{getPaymentSourceLabel(payment)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(payment.date || payment.createdAt)} • {payment.description || 'Supplier payment'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{payment.transType || 'payment'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No supplier payments recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Invoice History</CardTitle>
              <CardDescription>Every supplier invoice tied to this supplier profile.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice Ref</TableHead>
                        <TableHead>Line Items</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice._id}>
                          <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                          <TableCell className="font-medium">{getInvoiceRef(invoice)}</TableCell>
                          <TableCell>{getLineItemsCount(invoice)}</TableCell>
                          <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openInvoiceDialog(invoice)}
                            >
                              View Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No invoice history is available for this supplier yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Payment History</CardTitle>
              <CardDescription>Recorded supplier payments and linked transaction references.</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment._id}>
                          <TableCell>{formatDate(payment.date || payment.createdAt)}</TableCell>
                          <TableCell className="font-medium">{getTransactionRef(payment)}</TableCell>
                          <TableCell>{getPaymentSourceLabel(payment)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.transType || 'payment'}</Badge>
                          </TableCell>
                          <TableCell>{payment.description || 'Supplier payment'}</TableCell>
                          <TableCell>{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/finance/transaction/${payment._id}`}>
                                Open
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No supplier payments have been posted yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Supplier Ledger</CardTitle>
              <CardDescription>Running balance showing how invoices and payments changed the payable.</CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Entry</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Running Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerRows.map((entry) => {
                        const badge = getLedgerBadge(entry.kind);
                        const isIncrease = Number(entry.delta) > 0;

                        return (
                          <TableRow key={entry._id}>
                            <TableCell>{formatDateTime(entry.date)}</TableCell>
                            <TableCell className="font-medium">
                              {entry.sourceDocType === 'invoice'
                                ? getInvoiceRef({ _id: entry.sourceDocId })
                                : getTransactionRef({ _id: entry.sourceDocId })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell>{entry.description || 'Ledger entry'}</TableCell>
                            <TableCell className={isIncrease ? 'font-medium text-amber-700' : 'font-medium text-emerald-700'}>
                              {isIncrease ? '+' : '-'}
                              {formatCurrency(Math.abs(entry.delta))}
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">
                              {formatCurrency(entry.runningBalance)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No ledger activity exists for this supplier yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isInvoiceDialogOpen}
        onOpenChange={(open) => {
          setIsInvoiceDialogOpen(open);
          if (!open) {
            setSelectedInvoice(null);
            setSelectedReconciliations([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Review invoice totals, items, and supplier context.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Invoice Ref</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{getInvoiceRef(selectedInvoice)}</p>
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Invoice Date</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{formatDateTime(selectedInvoice.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Supplier</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{supplier.name}</p>
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total Amount</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{formatCurrency(selectedInvoice.totalAmount)}</p>
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
                    <Badge className="mt-2" variant={selectedInvoice.status === 'voided' ? 'destructive' : selectedInvoice.status === 'adjusted' ? 'secondary' : 'outline'}>
                      {selectedInvoice.status || 'posted'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Invoice Items</h3>
                  {selectedInvoice.items?.length > 0 ? (
                    <div className="mt-4 overflow-x-auto rounded-2xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Buy Price</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedInvoice.items.map((item, index) => (
                            <TableRow key={`${selectedInvoice._id}-${index}`}>
                              <TableCell>{item.productName || item.name || 'Unnamed item'}</TableCell>
                              <TableCell>{Number(item.quantity) || 0}</TableCell>
                              <TableCell>{formatCurrency(item.buyPrice)}</TableCell>
                              <TableCell>{formatCurrency((Number(item.quantity) || 0) * (Number(item.buyPrice) || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No line items were stored for this invoice.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <InvoiceReconciliationDialog
                    invoice={selectedInvoice}
                    mode="adjust"
                    onSuccess={() => fetchInvoiceReconciliations(selectedInvoice._id)}
                  />
                  <InvoiceReconciliationDialog
                    invoice={selectedInvoice}
                    mode="void"
                    onSuccess={() => fetchInvoiceReconciliations(selectedInvoice._id)}
                  />
                </div>

                <ReconciliationHistory
                  reconciliations={selectedReconciliations}
                  description="Correction cases linked to this supplier invoice"
                />
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
