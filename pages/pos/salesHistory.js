import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Link from 'next/link';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [category, setCategory] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, paymentMethod, category, minAmount, maxAmount]);

  const fetchSales = async () => {
    const result = await window.electronAPI.realmOperation('getAllSalesBetweenDates', startDate, endDate);
    if (result.success) {
      setSales(result.data);
    } else {
      console.error('Failed to fetch sales');
    }
  };

  const handleDateChange = (e, setter) => {
    setter(e.target.value);
  };

  const filterSales = () => {
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

    setFilteredSales(filtered);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sales History</h1>
      <div className="flex gap-4 mb-4">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => handleDateChange(e, setStartDate)}
          placeholder="Start Date"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => handleDateChange(e, setEndDate)}
          placeholder="End Date"
        />
        <Button onClick={fetchSales}>Fetch Sales</Button>
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
              <Select onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="MPESA">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
              {/* <Select onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="DAIRY">Electronics</SelectItem>
                  <SelectItem value="DRY FOODS">Clothing</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                </SelectContent>
              </Select> */}
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
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
            <TableHead>Paid</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSales.map((sale) => (
            <TableRow key={sale._id}>
              <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>{sale.customerName}</TableCell>
              <TableCell>{sale.totalAmount.toFixed(2)}</TableCell>
              <TableCell>{sale.totalItems}</TableCell>
              <TableCell>{sale.paymentMethod}</TableCell>
              <TableCell>{sale.type}</TableCell>
              <TableCell>{sale.paid ? 'Yes' : 'No'}</TableCell>
              <TableCell>
                <Link href={`/pos/${sale._id}`} passHref>
                  <Button variant="outline" size="sm">View Details</Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
