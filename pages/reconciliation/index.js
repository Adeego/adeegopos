import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { can } from '@/lib/rbac';

function getSourceLink(entry) {
  if (entry.sourceType === 'sale') {
    return `/pos/${entry.sourceId}`;
  }

  if (entry.sourceType === 'transaction') {
    return `/finance/transaction/${entry.sourceId}`;
  }

  if (entry.sourceType === 'invoice') {
    return `/finance?view=invoices&invoiceId=${encodeURIComponent(entry.sourceId)}`;
  }

  return '/reconciliation';
}

function formatSummary(entry) {
  const summary = entry?.impactPreview?.summary;
  if (!summary) {
    return 'No preview available';
  }

  return `${summary.stockDeltaCount || 0} stock, ${summary.customerDeltaCount || 0} customer, ${summary.accountDeltaCount || 0} account, ${summary.supplierDeltaCount || 0} supplier`;
}

export default function ReconciliationQueuePage() {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const staff = useStaffStore((state) => state.staff);
  const { toast } = useToast();

  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState('');

  const canApprove = useMemo(
    () => can(staff, 'reconciliation:approve'),
    [staff]
  );

  const fetchCases = async () => {
    if (!storeNo) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.realmOperation('getReconciliationCases', storeNo);
      if (result.success) {
        setReconciliations(result.reconciliations || []);
      } else {
        throw new Error(result.error || 'Failed to load reconciliation cases');
      }
    } catch (error) {
      toast({
        title: 'Load failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [storeNo]);

  const handleApprove = async (caseId) => {
    setActingId(caseId);
    try {
      const result = await window.electronAPI.realmOperation('approveReconciliationCase', caseId, staff);
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve reconciliation');
      }

      toast({
        title: 'Reconciliation approved',
        description: 'The correction has been posted successfully.',
      });
      fetchCases();
    } catch (error) {
      toast({
        title: 'Approval failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActingId('');
    }
  };

  const handleReject = async (caseId) => {
    const rejectionReason = typeof window !== 'undefined'
      ? window.prompt('Optional rejection note:') || ''
      : '';

    setActingId(caseId);
    try {
      const result = await window.electronAPI.realmOperation('rejectReconciliationCase', caseId, staff, rejectionReason);
      if (!result.success) {
        throw new Error(result.error || 'Failed to reject reconciliation');
      }

      toast({
        title: 'Reconciliation rejected',
        description: 'The case was rejected and remains in history.',
      });
      fetchCases();
    } catch (error) {
      toast({
        title: 'Rejection failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActingId('');
    }
  };

  const filteredByStatus = (status) => (
    status === 'all'
      ? reconciliations
      : reconciliations.filter((entry) => entry.status === status)
  );

  const renderList = (items) => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reconciliation cases...
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No reconciliation cases found for this filter.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((entry) => {
          const busy = actingId === entry._id;
          const sourceLink = getSourceLink(entry);
          const showActions = canApprove && entry.status === 'pending_approval';

          return (
            <Card key={entry._id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{entry.caseType}</CardTitle>
                    <CardDescription>
                      {new Date(entry.createdAt).toLocaleString()} by {entry.initiatedBy?.name || 'Unknown staff'}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{entry.reasonCode}</Badge>
                    <Badge variant={entry.status === 'posted' ? 'default' : entry.status === 'rejected' ? 'destructive' : 'outline'}>
                      {entry.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Source</div>
                    <div className="mt-1 text-sm font-medium">{entry.sourceType}: {entry.sourceId}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Impact</div>
                    <div className="mt-1 text-sm">{formatSummary(entry)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Linked Docs</div>
                    <div className="mt-1 text-sm">{(entry.linkedDocIds || []).length}</div>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  {entry.notes || 'No notes provided.'}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={sourceLink}>
                    <Button variant="outline" size="sm">Open Source</Button>
                  </Link>

                  {showActions && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleReject(entry._id)} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(entry._id)} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reconciliation Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review posted corrections for sales, supplier invoices, and payment transactions.
        </p>
      </div>

      <Tabs defaultValue="pending_approval" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending_approval">Pending</TabsTrigger>
          <TabsTrigger value="posted">Posted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="pending_approval" className="mt-4">
          {renderList(filteredByStatus('pending_approval'))}
        </TabsContent>
        <TabsContent value="posted" className="mt-4">
          {renderList(filteredByStatus('posted'))}
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          {renderList(filteredByStatus('rejected'))}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          {renderList(filteredByStatus('all'))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
