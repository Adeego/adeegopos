import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ViewSale() {
  const [sale, setSale] = useState(null);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchSale(id);
    }
  }, [id]);

  const fetchSale = async (saleId) => {
    const result = await window.electronAPI.realmOperation('getSaleById', saleId);
    if (result.success) {
      setSale(result.data);
    } else {
      console.error('Failed to fetch sale');
    }
  };

  if (!sale) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sale Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Customer:</p>
              <p>{sale.customerName}</p>
            </div>
            <div>
              <p className="font-semibold">Total Amount:</p>
              <p>${sale.totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="font-semibold">Payment Method:</p>
              <p>{sale.paymentMethod}</p>
            </div>
            <div>
              <p className="font-semibold">Date:</p>
              <p>{new Date(sale.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-semibold">Status:</p>
              <p>{sale.paid ? 'Paid' : 'Unpaid'}</p>
            </div>
            <div>
              <p className="font-semibold">Type:</p>
              <p>{sale.type}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sale Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Discount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.variantName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell>${item.subtotal.toFixed(2)}</TableCell>
                  <TableCell>${item.discount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
