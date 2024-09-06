import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchSales();
  }, []);

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
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale._id}>
              <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>{sale.customerName}</TableCell>
              <TableCell>{sale.totalAmount.toFixed(2)}</TableCell>
              <TableCell>{sale.totalItems}</TableCell>
              <TableCell>{sale.paymentMethod}</TableCell>
              <TableCell>{sale.type}</TableCell>
              <TableCell>{sale.paid ? 'Yes' : 'No'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
