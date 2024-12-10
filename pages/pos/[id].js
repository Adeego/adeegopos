import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator"
import { CalendarIcon, CreditCardIcon, UserIcon, TagIcon, CheckCircleIcon, XCircleIcon, ShoppingBasket, User, Phone, MapPin, CreditCard, PhoneIcon, MapPinIcon, ShoppingBasketIcon } from "lucide-react"
import { Badge } from '@/components/ui/badge';

export default function ViewSale() {
  const [sale, setSale] = useState(null);
  const [customer, setCustomer] = useState([])
  const [customerId, setCustomerId] = useState(null)
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchSale(id);
    }
  }, [id]);

  useEffect(() => {
    if (customerId) {
      fetchCustomer(customerId);
    }
  }, [customerId])

  const fetchCustomer = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getCustomerById', customerId);
      if (result.success) {
        setCustomer(result.customer);
        console.log(result.customer);
      } else {
        console.error('Failed to fetch customer:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  }

  const fetchSale = async (saleId) => {
    const result = await window.electronAPI.realmOperation('getSaleById', saleId);
    if (result.success) {
      setSale(result.data);
      setCustomerId(result.data.customerId)
    } else {
      console.error('Failed to fetch sale');
    }
  };

  if (!sale) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6 bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-2xl font-semibold text-primary">Sale Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <InfoItem icon={<UserIcon className="w-5 h-5" />} label="Sale Type" value={sale.saleType} />
              <InfoItem icon={<CreditCardIcon className="w-5 h-5" />} label="Total Amount" value={`KES ${sale.totalAmount.toFixed(2)}`} />
              <InfoItem icon={<CreditCardIcon className="w-5 h-5" />} label="Payment Method" value={sale.paymentMethod} />
              <InfoItem icon={<CalendarIcon className="w-5 h-5" />} label="Date" value={new Date(sale.createdAt).toLocaleString()} />
              <InfoItem icon={<ShoppingBasketIcon className="w-5 h-5" />} label="Items" value={sale.totalItems.toString()} />
              <InfoItem icon={<TagIcon className="w-5 h-5" />} label="Type" value={sale.fullfilmentType} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-2xl font-semibold text-primary">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={<UserIcon className="w-5 h-5" />} label="Name" value={customer.name} />
              <InfoItem icon={<PhoneIcon className="w-5 h-5" />} label="Phone Number" value={customer.phoneNumber} />
              <InfoItem icon={<MapPinIcon className="w-5 h-5" />} label="Address" value={customer.address} />
              <InfoItem
                icon={<CreditCardIcon className="w-5 h-5" />}
                label="Credit"
                value={
                  <Badge variant={customer.credit ? "success" : "destructive"}>
                    {customer.credit ? "Approved" : "Not Approved"}
                  </Badge>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-2xl font-semibold text-primary">Sale Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Conversion Factor</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.conversionFactor}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>KES {item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell>KES {item.subtotal.toFixed(2)}</TableCell>
                    <TableCell>KES {item.discount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/10">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-base font-semibold">{value}</div>
      </div>
    </div>
  )
}
