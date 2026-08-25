import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowRightLeft, Eye } from 'lucide-react';
import useWsinfoStore from '@/stores/wsinfo';
import SaleReconciliationDialog from '@/components/reconciliation/SaleReconciliationDialog';

function DatePickerWithPresets({ date, setDate }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-auto flex-col space-y-2 p-2"
      >
        <Select
          onValueChange={(value) =>
            setDate(addDays(new Date(), parseInt(value)))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="0">Today</SelectItem>
            <SelectItem value="1">Tomorrow</SelectItem>
            <SelectItem value="3">In 3 days</SelectItem>
            <SelectItem value="7">In a week</SelectItem>
          </SelectContent>
        </Select>
        <div className="rounded-md border">
          <Calendar mode="single" selected={date} onSelect={setDate} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getSaleDisplayAmount(sale) {
  if (sale.status === 'failed') {
    return Number(sale.totalAmount) || 0;
  }

  return Number(sale.netTotalAmount ?? sale.totalAmount) || 0;
}

export default function SalesHistory() {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const [sales, setSales] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [category, setCategory] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [fulfillment, setFulfillment] = useState(null);
  const [saleType, setSaleType] = useState(null);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [amountSearch, setAmountSearch] = useState('');
  const [historyView, setHistoryView] = useState('posted');
  const [syncStatus, setSyncStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const fetchSales = useCallback(async () => {
    if (!storeNo) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (!startDate || !endDate) {
        throw new Error('Select both a start date and an end date.');
      }

      const operation = historyView === 'failed'
        ? 'getFailedSalesBetweenDates'
        : 'getAllSalesBetweenDates';
      const result = await window.electronAPI.realmOperation(
        operation,
        storeNo,
        startOfDay(startDate).toISOString(),
        endOfDay(endDate).toISOString()
      );

      if (result.success) {
        setSales(result.data);
        setCurrentPage(1);
      } else {
        setError('Failed to fetch sales: ' + result.error);
        console.error('Failed to fetch sales', result.error);
      }
    } catch (err) {
      setError('An error occurred while fetching sales: ' + err.message);
      console.error('Error in fetchSales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [endDate, historyView, startDate, storeNo]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    if (!window.electronAPI) {
      return undefined;
    }

    window.electronAPI.getSyncStatus?.().then(setSyncStatus).catch(() => {});
    const removeSyncListener = window.electronAPI.onSyncStatusChanged?.((status) => {
      setSyncStatus(status);
      if (status.direction === 'pull' && status.salesChanged) {
        fetchSales();
      }
    });
    const refreshOnFocus = () => fetchSales();
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      removeSyncListener?.();
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [fetchSales]);

  const filteredSales = useMemo(() => {
    let filtered = sales;

    if (paymentMethod) {
      filtered = filtered.filter(sale => sale.paymentMethod === paymentMethod);
    }

    if (category) {
      filtered = filtered.filter(sale => sale.items.some(item => item.category === category));
    }

    if (minAmount) {
      filtered = filtered.filter(sale => getSaleDisplayAmount(sale) >= parseFloat(minAmount));
    }

    if (maxAmount) {
      filtered = filtered.filter(sale => getSaleDisplayAmount(sale) <= parseFloat(maxAmount));
    }

    if (fulfillment) {
      filtered = filtered.filter(sale => sale.fullfilmentType === fulfillment);
    }

    if (saleType) {
      filtered = filtered.filter(sale => sale.saleType === saleType);
    }

    const normalizedReceipt = receiptSearch.trim().toLowerCase();
    if (normalizedReceipt) {
      filtered = filtered.filter((sale) => String(sale._id || '').toLowerCase().includes(normalizedReceipt));
    }

    if (amountSearch !== '') {
      const amount = Number(amountSearch);
      if (Number.isFinite(amount)) {
        filtered = filtered.filter((sale) => Math.abs(getSaleDisplayAmount(sale) - amount) < 0.005);
      }
    }

    return filtered;
  }, [amountSearch, category, fulfillment, maxAmount, minAmount, paymentMethod, receiptSearch, saleType, sales]);

  useEffect(() => {
    setCurrentPage(1);
  }, [amountSearch, category, fulfillment, maxAmount, minAmount, paymentMethod, receiptSearch, rowsPerPage, saleType]);

  const indexOfLastSale = currentPage * rowsPerPage;
  const indexOfFirstSale = indexOfLastSale - rowsPerPage;
  const currentSales = filteredSales.slice(indexOfFirstSale, indexOfLastSale);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const clearFilter = (setter) => {
    setter(null);
  };

  return (
    <Card className="container mx-auto p-4">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Sales History</CardTitle>
            <CardDescription className="text-left">
              View your sales history and filter by date, payment method, items, and amounts.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="mb-4 flex flex-wrap gap-4">
        <DatePickerWithPresets date={startDate} setDate={setStartDate} />
        <DatePickerWithPresets date={endDate} setDate={setEndDate} />
        <Button onClick={fetchSales} disabled={isLoading}>
          {isLoading ? 'Fetching...' : 'Fetch Sales'}
        </Button>
        <Select value={historyView} onValueChange={setHistoryView}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="History view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="posted">Posted sales</SelectItem>
            <SelectItem value="failed">Failed postings</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-[260px]"
          placeholder="Search receipt ID"
          value={receiptSearch}
          onChange={(event) => setReceiptSearch(event.target.value)}
        />
        <Input
          className="w-[180px]"
          type="number"
          step="0.01"
          placeholder="Exact amount"
          value={amountSearch}
          onChange={(event) => setAmountSearch(event.target.value)}
        />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Filters</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Sales</SheetTitle>
              <SheetDescription>Apply filters to the sales data</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-2">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Payment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                    <SelectItem value="MPESA">M-Pesa</SelectItem>
                    <SelectItem value="HYBRID">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => clearFilter(setPaymentMethod)} variant="outline" size="sm">Clear</Button>
              </div>
              <Input
                type="number"
                placeholder="Min Amount"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max Amount"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Select value={fulfillment} onValueChange={setFulfillment}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Fulfillment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                    <SelectItem value="WALK-IN-CLIENT">Walk-in Client</SelectItem>
                  </SelectContent>
                </Select> 
                <Button onClick={() => clearFilter(setFulfillment)} variant="outline" size="sm">Clear</Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={saleType} onValueChange={setSaleType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sale Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW SALE">New Sale</SelectItem>
                    <SelectItem value="RETURN SALE">Return Sale</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => clearFilter(setSaleType)} variant="outline" size="sm">Clear</Button>
              </div>
            </div>
            <SheetFooter>
              <span className="text-sm text-muted-foreground">Filters apply automatically.</span>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Select value={rowsPerPage.toString()} onValueChange={(value) => setRowsPerPage(Number(value))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rows per page" />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20, 50].map((value) => (
              <SelectItem key={value} value={value.toString()}>{value} rows</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {syncStatus?.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Sales synchronization needs attention</AlertTitle>
          <AlertDescription>{syncStatus.error}</AlertDescription>
        </Alert>
      )}
      {syncStatus && !syncStatus.error && (
        <div className="mb-4 text-xs text-muted-foreground">
          Sync: {syncStatus.state || 'idle'}
          {syncStatus.lastSuccessAt ? ` · Last successful ${new Date(syncStatus.lastSuccessAt).toLocaleString()}` : ''}
        </div>
      )}
      
      <CardContent>
        <Table>
          <TableCaption>A list of your recent sales.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Receipt ID</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Transaction Cost</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Failure Reason</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentSales.map((sale) => (
              <TableRow key={sale._id}>
                <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(sale.createdAt).toLocaleTimeString()}</TableCell>
                <TableCell className="max-w-[220px] truncate font-mono text-xs" title={sale._id}>{sale._id}</TableCell>
                <TableCell>{getSaleDisplayAmount(sale).toFixed(2)}</TableCell>
                <TableCell>{(sale.transactionCost || 0).toFixed(2)}</TableCell>
                <TableCell>{sale.totalItems}</TableCell>
                <TableCell>{sale.paymentMethod}</TableCell>
                <TableCell>{sale.saleType}</TableCell>
                <TableCell>
                  <span className='inline-flex rounded-full border px-2 py-1 text-xs font-medium'>
                    {sale.status || 'posted'}
                  </span>
                </TableCell>
                <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                  {sale.postingError || '—'}
                </TableCell>
                <TableCell>
                  <div className=' flex flex-row gap-2 ' >
                    <Link href={`/pos/${sale._id}`} passHref className='h-8 w-8 flex justify-center items-center rounded-md hover:bg-neutral-200' >
                      <Eye />
                    </Link>
                    {sale.status !== 'failed' && (
                      <SaleReconciliationDialog
                        sale={sale}
                        onSuccess={fetchSales}
                        trigger={
                          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            Reconcile
                          </Button>
                        }
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && currentSales.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                  {sales.length === 0
                    ? `No ${historyView === 'failed' ? 'failed postings' : 'posted sales'} were found in the selected date range.`
                    : 'No sales match the current receipt, amount, or detail filters.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{filteredSales.length === 0 ? 0 : indexOfFirstSale + 1}-{Math.min(indexOfLastSale, filteredSales.length)}</strong> of <strong>{filteredSales.length}</strong> records
          {' · '}Page <strong>{filteredSales.length === 0 ? 0 : currentPage}</strong> of <strong>{Math.ceil(filteredSales.length / rowsPerPage)}</strong>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => paginate(currentPage + 1)}
            disabled={indexOfLastSale >= filteredSales.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
