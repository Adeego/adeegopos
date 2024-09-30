import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator"
import { CalendarIcon, CreditCardIcon, UserIcon, TagIcon, CheckCircleIcon, XCircleIcon, ShoppingBasket } from "lucide-react"

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
      console.log(result);
    } else {
      console.error('Failed to fetch sale');
    }
  };

  if (!sale) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full bg-[#f8f8f8] border overflow-hidden border-gray-200 shadow-md mb-4">
      <CardHeader className="border-b border-gray-200 bg-white">
        <CardTitle className="text-2xl font-serif text-gray-800">Sale Details</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <UserIcon className="w-5 h-5" />
              <p className="font-semibold">Sale Type</p>
            </div>
            <p className="text-lg text-gray-800">{sale.saleType}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <CreditCardIcon className="w-5 h-5" />
              <p className="font-semibold">Total Amount</p>
            </div>
            <p className="text-lg text-gray-800">KES {sale.totalAmount.toFixed(2)}</p>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <CreditCardIcon className="w-5 h-5" />
              <p className="font-semibold">Payment Method</p>
            </div>
            <p className="text-gray-800">{sale.paymentMethod}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <CalendarIcon className="w-5 h-5" />
              <p className="font-semibold">Date</p>
            </div>
            <p className="text-gray-800">{new Date(sale.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <ShoppingBasket />
              <p className="font-semibold">Items</p>
            </div>
            <p className="text-gray-800">{sale.totalItems}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <TagIcon className="w-5 h-5" />
              <p className="font-semibold">Type</p>
            </div>
            <p className="text-gray-800">{sale.fullfilmentType}</p>
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
                <TableHead>Name</TableHead>
                <TableHead>Conversion Factor</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Subtotal</TableHead>
                {/* <TableHead>Discount</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.conversionFactor}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>KES {item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell>KES {item.subtotal.toFixed(2)}</TableCell>
                  {/* <TableCell>${item.discount.toFixed(2)}</TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
