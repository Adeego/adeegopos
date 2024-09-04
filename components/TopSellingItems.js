import React, { useEffect, useState } from 'react';
import { getTopSellingItems } from '../../electron/services/saleService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TopSellingItems() {
  const [topItems, setTopItems] = useState([]);

  useEffect(() => {
    async function fetchTopSellingItems() {
      const realm = await getRealmInstance(); // Assuming you have a function to get the Realm instance
      const { success, data } = await getTopSellingItems(realm, '2024-01-01', '2024-12-31', 10);
      if (success) {
        setTopItems(data);
      } else {
        console.error('Failed to fetch top selling items');
      }
    }

    fetchTopSellingItems();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Top Selling Items</h2>
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
    </div>
  );
}
