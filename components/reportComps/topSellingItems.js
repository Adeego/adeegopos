import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import useWsinfoStore from '@/stores/wsinfo';

export default function TopSellingItems() {
  const [topItems, setTopItems] = useState([]);
  const store = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState('');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    async function fetchTopSellingItems() {
      if (!storeNo) return;
      const startDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
      const endDate = new Date().toISOString();
      const result = await window.electronAPI.realmOperation('getTopSellingItems', { startDate, endDate, storeNo });
      if (result.success) {
        setTopItems(result.data);
      } else {
        console.error('Failed to fetch top selling items');
      }
    }

    fetchTopSellingItems();
  }, [storeNo]);

  return (
    <Card>
      <CardHeader >
        <CardTitle className="text-2xl font-bold mb-4">Top Selling Items</CardTitle>
      </CardHeader>
      <CardContent >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Total Sales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.totalSales}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
