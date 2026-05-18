import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import useWsinfoStore from '@/stores/wsinfo';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TransactionReconciliationDialog from '@/components/reconciliation/TransactionReconciliationDialog';
import ReconciliationHistory from '@/components/reconciliation/ReconciliationHistory';

export default function TransactionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const store = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [reconciliations, setReconciliations] = useState([]);

  useEffect(() => {
    if (store?.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (id && storeNo) {
      fetchTransactionDetail();
      fetchReconciliations();
    }
  }, [id, storeNo]);

  const fetchTransactionDetail = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getTransactionById', id, storeNo);
      if (result.success) {
        setTransaction(result.transaction);
      } else {
        throw new Error(result.error || 'Failed to fetch transaction details');
      }
    } catch (error) {
      toast({
        title: 'Load failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchReconciliations = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getReconciliationBySource', 'transaction', id, storeNo);
      if (result.success) {
        setReconciliations(result.reconciliations || []);
      } else {
        throw new Error(result.error || 'Failed to fetch reconciliation history');
      }
    } catch (error) {
      console.error('Failed to fetch transaction reconciliations:', error);
    }
  };

  if (!transaction) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="w-full overflow-hidden rounded-lg bg-white shadow-lg">
        <CardHeader className="border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-semibold text-gray-800">Transaction Details</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                This transaction was recorded on {new Date(transaction.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={transaction.status === 'reversed' ? 'destructive' : transaction.status === 'replaced' ? 'secondary' : 'default'}>
                {transaction.status || 'posted'}
              </Badge>
              <Badge variant="outline">{transaction.transType}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <DetailRow label="Description" value={transaction.description} />
            <DetailRow label="Amount" value={`KES ${Number(transaction.amount || 0).toFixed(2)}`} />
            <DetailRow label="Transaction Cost" value={`KES ${Number(transaction.transactionCost || 0).toFixed(2)}`} />
            <DetailRow label="Source" value={`${transaction.source}: ${transaction.from}`} />
            <DetailRow label="Destination" value={`${transaction.destination}: ${transaction.to}`} />
            <DetailRow label="Date" value={new Date(transaction.date).toLocaleDateString()} />
          </div>
        </CardContent>
        <CardFooter className="border-t border-gray-200 bg-gray-50 p-6">
          <div className="flex w-full flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => router.push('/finance?view=transactions')}>Back</Button>
            <div className="flex flex-wrap gap-2">
              <TransactionReconciliationDialog
                transaction={transaction}
                mode="reverse"
                onSuccess={fetchReconciliations}
              />
              <TransactionReconciliationDialog
                transaction={transaction}
                mode="replace"
                onSuccess={fetchReconciliations}
              />
            </div>
          </div>
        </CardFooter>
      </Card>

      <ReconciliationHistory
        reconciliations={reconciliations}
        description="Correction cases linked to this transaction"
      />
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2">
      <div className="text-sm font-medium text-gray-600">{label.toUpperCase()}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}
