import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';

export default function TopCustomers() {
  const [topCustomers, setTopCustomers] = useState([]);

  useEffect(() => {
    async function fetchTopCustomers() {
      const startDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
      const endDate = new Date().toISOString();
      const result = await window.electronAPI.realmOperation('getTopCustomers', startDate, endDate);
      if (result.success) {
        setTopCustomers(result.data);
      } else {
        console.error('Failed to fetch top customers');
      }
    }

    fetchTopCustomers();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold mb-4">Top Customers</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Total Sales</TableHead>
              <TableHead>Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCustomers.map((customer, index) => (
              <TableRow key={index}>
                <TableCell>{customer.customerName}</TableCell>
                <TableCell>{customer.totalSales}</TableCell>
                <TableCell>{customer.totalAmount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
