import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarIcon, CreditCardIcon, EyeIcon, TrendingDown, TrendingUp, Users, WalletCards } from 'lucide-react';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useWsinfoStore from '@/stores/wsinfo';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

function toAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(toAmount(value));
}

function toDateInputValue(date = new Date()) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSaleCreditAmount(sale = {}) {
  const breakdown = Array.isArray(sale.paymentBreakdown) && sale.paymentBreakdown.length > 0
    ? sale.paymentBreakdown
    : [{ method: sale.paymentMethod, amount: sale.netTotalAmount ?? sale.totalAmount }];

  return breakdown
    .filter((payment) => String(payment.method || payment.paymentMethod || '').toUpperCase() === 'CREDIT')
    .reduce((sum, payment) => sum + Math.abs(toAmount(payment.amount)), 0);
}

function getCustomerName(customer) {
  return customer?.name || 'Unknown customer';
}

function getCustomerPhone(customer) {
  return customer?.phoneNumber || '-';
}

function SummaryCard({ title, value, description, icon: Icon, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'text-red-700'
    : tone === 'success'
      ? 'text-emerald-700'
      : 'text-primary';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function ManageCredit() {
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [overview, setOverview] = useState({
    customers: [],
    summary: {
      totalOutstanding: 0,
      totalStoreCredit: 0,
      debtorsCount: 0,
      creditApprovedCount: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const store = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState('');
  const [fromDate, setFromDate] = useState(() => toDateInputValue());
  const [toDate, setToDate] = useState(() => toDateInputValue());

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  const fetchCreditReview = useCallback(async () => {
    if (!storeNo) return;

    setLoading(true);
    setError(null);

    try {
      const query = { storeNo, fromDate, toDate };
      const [salesResult, transactionsResult, overviewResult] = await Promise.all([
        window.electronAPI.realmOperation('getTodayCreditSales', query),
        window.electronAPI.realmOperation('getTodayCustomerTransactions', query),
        window.electronAPI.realmOperation('getCustomerCreditOverview', { storeNo }),
      ]);

      if (!salesResult.success) {
        throw new Error(salesResult.error || 'Failed to fetch credit sales');
      }
      if (!transactionsResult.success) {
        throw new Error(transactionsResult.error || 'Failed to fetch customer transactions');
      }
      if (!overviewResult.success) {
        throw new Error(overviewResult.error || 'Failed to fetch credit overview');
      }

      setSales(salesResult.sales || []);
      setTransactions(transactionsResult.transactions || []);
      setOverview({
        customers: overviewResult.customers || [],
        summary: {
          totalOutstanding: overviewResult.summary?.totalOutstanding || 0,
          totalStoreCredit: overviewResult.summary?.totalStoreCredit || 0,
          debtorsCount: overviewResult.summary?.debtorsCount || 0,
          creditApprovedCount: overviewResult.summary?.creditApprovedCount || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching customer credit review:', error);
      setError(error.message || 'Failed to load credit review');
    } finally {
      setLoading(false);
    }
  }, [fromDate, storeNo, toDate]);

  useEffect(() => {
    if (!storeNo) return;
    fetchCreditReview();
  }, [fetchCreditReview, storeNo]);

  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => {
      const aValue = sortColumn === 'creditAmount' ? getSaleCreditAmount(a) : a[sortColumn];
      const bValue = sortColumn === 'creditAmount' ? getSaleCreditAmount(b) : b[sortColumn];
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortColumn === 'createdAt') {
        return ((new Date(aValue).getTime() || 0) - (new Date(bValue).getTime() || 0)) * direction;
      }

      if (typeof aValue === 'number' || typeof bValue === 'number') {
        return (toAmount(aValue) - toAmount(bValue)) * direction;
      }

      return String(aValue || '').localeCompare(String(bValue || '')) * direction;
    });
  }, [sales, sortColumn, sortDirection]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const firstDate = new Date(a.date || a.createdAt).getTime() || 0;
      const secondDate = new Date(b.date || b.createdAt).getTime() || 0;
      return secondDate - firstDate || String(a._id || '').localeCompare(String(b._id || ''));
    });
  }, [transactions]);

  const debtors = useMemo(() => {
    return [...(overview.customers || [])]
      .filter((customer) => toAmount(customer.amountOwed) > 0)
      .sort((a, b) => toAmount(b.amountOwed) - toAmount(a.amountOwed) || getCustomerName(a).localeCompare(getCustomerName(b)));
  }, [overview.customers]);

  const creditSalesTotal = useMemo(
    () => sales.reduce((sum, sale) => sum + getSaleCreditAmount(sale), 0),
    [sales]
  );

  const repaymentsTotal = useMemo(
    () => transactions.reduce((sum, transaction) => sum + toAmount(transaction.amount), 0),
    [transactions]
  );

  const netCreditMovement = creditSalesTotal - repaymentsTotal;

  const handleSort = (column) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (column) => {
    if (column !== sortColumn) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Management</h1>
          <p className="text-sm text-muted-foreground">
            Review credit exposure, credit sales, and repayments from the customer table flow.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="credit-from-date">From</label>
            <Input
              id="credit-from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="credit-to-date">To</label>
            <Input
              id="credit-to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <Button onClick={fetchCreditReview} disabled={loading || !storeNo}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Credit Sales"
          value={formatCurrency(creditSalesTotal)}
          description={`${sales.length} sale${sales.length === 1 ? '' : 's'} in range`}
          icon={CreditCardIcon}
          tone="danger"
        />
        <SummaryCard
          title="Credit Repaid"
          value={formatCurrency(repaymentsTotal)}
          description={`${transactions.length} repayment${transactions.length === 1 ? '' : 's'} in range`}
          icon={TrendingUp}
          tone="success"
        />
        <SummaryCard
          title="Net Movement"
          value={formatCurrency(netCreditMovement)}
          description={netCreditMovement >= 0 ? 'More credit issued than repaid' : 'More repaid than issued'}
          icon={TrendingDown}
          tone={netCreditMovement >= 0 ? 'danger' : 'success'}
        />
        <SummaryCard
          title="Outstanding Debt"
          value={formatCurrency(overview.summary.totalOutstanding)}
          description={`${overview.summary.debtorsCount} customer${overview.summary.debtorsCount === 1 ? '' : 's'} owing`}
          icon={WalletCards}
          tone="danger"
        />
        <SummaryCard
          title="Credit Approved"
          value={overview.summary.creditApprovedCount}
          description={`${formatCurrency(overview.summary.totalStoreCredit)} store credit held`}
          icon={Users}
        />
      </div>

      <Tabs defaultValue="debtors" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="debtors">Debtors</TabsTrigger>
          <TabsTrigger value="sales">Credit Sales</TabsTrigger>
          <TabsTrigger value="transactions">Credits Repaid</TabsTrigger>
        </TabsList>

        <TabsContent value="debtors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customers Owing</CardTitle>
              <CardDescription>Sorted by largest outstanding balance.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">Loading debtors...</div>
              ) : debtors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Credit</TableHead>
                      <TableHead className="text-right">Amount Owed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debtors.map((customer) => (
                      <TableRow key={customer._id}>
                        <TableCell className="font-medium">{getCustomerName(customer)}</TableCell>
                        <TableCell>{getCustomerPhone(customer)}</TableCell>
                        <TableCell>
                          <Badge variant={customer.creditApproved ? 'default' : 'secondary'}>
                            {customer.creditApproved ? 'Approved' : 'Not approved'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-700">
                          {formatCurrency(customer.amountOwed)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/customers/${customer._id}`}>
                              <EyeIcon className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  No customers currently owe money.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Sales</CardTitle>
              <CardDescription>Credit sales recorded in the selected date range.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">Loading credit sales...</div>
              ) : sortedSales.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('createdAt')}>
                        Date{sortIndicator('createdAt')}
                      </TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort('creditAmount')}>
                        Credit Amount{sortIndicator('creditAmount')}
                      </TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSales.map((sale) => (
                      <TableRow key={sale._id}>
                        <TableCell>
                          <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            {formatDateTime(sale.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{getCustomerName(sale.customerDetails)}</span>
                            <span className="text-xs text-muted-foreground">{getCustomerPhone(sale.customerDetails)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-700">
                          {formatCurrency(getSaleCreditAmount(sale))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="w-fit">
                            <CreditCardIcon className="mr-1 h-3 w-3" />
                            {sale.paymentMethod || 'CREDIT'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/pos/${sale._id}`}>
                              <EyeIcon className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  No credit sales found for the selected date range.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Credits Repaid</CardTitle>
              <CardDescription>Customer repayments recorded in the selected date range.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">Loading repayments...</div>
              ) : sortedTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map((transaction) => (
                      <TableRow key={transaction._id} className="transition-colors hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{getCustomerName(transaction.customerDetails)}</span>
                            <span className="text-xs text-muted-foreground">{getCustomerPhone(transaction.customerDetails)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateTime(transaction.date || transaction.createdAt)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>{transaction.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  No customer repayments found for the selected date range.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
