import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import ArchiveSale from '@/components/posComps/archiveSale';
import { Eye } from 'lucide-react';

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

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, paymentMethod, category, minAmount, maxAmount, fulfillment, saleType]);

  const fetchSales = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.realmOperation('getAllSalesBetweenDates', startDate.toISOString(), endDate.toISOString());
      console.log('Fetch sales result:', result);
      if (result.success) {
        setSales(result.data);
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
  };

  const filterSales = () => {
    console.log('Filtering sales with criteria:', { paymentMethod, category, minAmount, maxAmount, fulfillment, saleType });
    let filtered = sales;

    if (paymentMethod) {
      filtered = filtered.filter(sale => sale.paymentMethod === paymentMethod);
    }

    if (category) {
      filtered = filtered.filter(sale => sale.items.some(item => item.category === category));
    }

    if (minAmount) {
      filtered = filtered.filter(sale => sale.totalAmount >= parseFloat(minAmount));
    }

    if (maxAmount) {
      filtered = filtered.filter(sale => sale.totalAmount <= parseFloat(maxAmount));
    }

    if (fulfillment) {
      filtered = filtered.filter(sale => sale.fullfilmentType === fulfillment);
    }

    if (saleType) {
      filtered = filtered.filter(sale => sale.saleType === saleType);
    }

    console.log('Filtered sales count:', filtered.length);
    setFilteredSales(filtered);
  };

  const indexOfLastSale = currentPage * rowsPerPage;
  const indexOfFirstSale = indexOfLastSale - rowsPerPage;
  const currentSales = filteredSales.slice(indexOfFirstSale, indexOfLastSale);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const applyFilters = () => {
    filterSales();
  };

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

      <div className="flex gap-4 mb-4">
        <DatePickerWithPresets date={startDate} setDate={setStartDate} />
        <DatePickerWithPresets date={endDate} setDate={setEndDate} />
        <Button onClick={fetchSales} disabled={isLoading}>
          {isLoading ? 'Fetching...' : 'Fetch Sales'}
        </Button>
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
              <Button onClick={applyFilters}>Apply Filters</Button>
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
      
      <CardContent>
        <Table>
          <TableCaption>A list of your recent sales.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentSales.map((sale) => (
              <TableRow key={sale._id}>
                <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{sale.customerName}</TableCell>
                <TableCell>{sale.totalAmount.toFixed(2)}</TableCell>
                <TableCell>{sale.totalItems}</TableCell>
                <TableCell>{sale.paymentMethod}</TableCell>
                <TableCell>{sale.type}</TableCell>
                <TableCell>{sale.fulfillment}</TableCell>
                <TableCell>{sale.paid ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <div className=' flex flex-row gap-2 ' >
                    <Link href={`/pos/${sale._id}`} passHref className='h-8 w-8 flex justify-center items-center rounded-md hover:bg-neutral-200' >
                      <Eye />
                    </Link>
                    <ArchiveSale saleId={sale._id} onDeleteSuccess={fetchSales} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{indexOfFirstSale + 1}-{Math.min(indexOfLastSale, filteredSales.length)}</strong> of <strong>{filteredSales.length}</strong> sales
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
