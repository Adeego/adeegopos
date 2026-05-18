import React from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReconciliationHistory({
  title = 'Reconciliation History',
  description = 'Cases linked to this record',
  reconciliations = [],
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {reconciliations.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No reconciliation cases linked yet.
          </div>
        ) : (
          reconciliations.map((entry) => (
            <div key={entry._id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{entry.caseType}</Badge>
                <Badge variant={entry.status === 'posted' ? 'default' : entry.status === 'rejected' ? 'destructive' : 'outline'}>
                  {entry.status}
                </Badge>
              </div>
              <div className="mt-2 text-sm">
                <div className="font-medium">{entry.reasonCode || 'general_correction'}</div>
                <div className="text-muted-foreground">
                  {entry.notes || 'No notes provided'}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
                <Link href="/reconciliation">
                  <Button variant="ghost" size="sm">View Queue</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
