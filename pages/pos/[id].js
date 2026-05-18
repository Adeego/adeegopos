import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator"
import { CalendarIcon, CreditCardIcon, UserIcon, TagIcon, CheckCircleIcon, XCircleIcon, ShoppingBasket, User, Phone, MapPin, CreditCard, PhoneIcon, MapPinIcon, ShoppingBasketIcon } from "lucide-react"
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react'
import SaleReconciliationDialog from '@/components/reconciliation/SaleReconciliationDialog';
import ReconciliationHistory from '@/components/reconciliation/ReconciliationHistory';

const formatPaymentBreakdown = (sale = {}) => {
  if (!Array.isArray(sale.paymentBreakdown) || sale.paymentBreakdown.length === 0 || sale.paymentMethod !== 'HYBRID') {
    return sale.paymentMethod;
  }

  return sale.paymentBreakdown
    .map((payment) => `${payment.method}: KES ${Number(payment.amount || 0).toFixed(2)}`)
    .join(', ');
};

export default function ViewSale() {
  const [sale, setSale] = useState(null);
  const [customer, setCustomer] = useState([])
  const [customerId, setCustomerId] = useState(null)
  const [reconciliations, setReconciliations] = useState([])
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

  useEffect(() => {
    if (id && sale?.storeNo) {
      fetchReconciliations();
    }
  }, [id, sale?.storeNo])

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
      setCustomerId(result.data.currentCustomerId || result.data.customerId)
    } else {
      console.error('Failed to fetch sale');
    }
  };

  const fetchReconciliations = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getReconciliationBySource', 'sale', id, sale?.storeNo);
      if (result.success) {
        setReconciliations(result.reconciliations || []);
      } else {
        console.error('Failed to fetch reconciliations:', result.error);
      }
    } catch (error) {
      console.error('Error fetching reconciliations:', error);
    }
  }

  const handlePrint = async () => {
    try {
      const result = await window.electronAPI.realmOperation('printReceipt', sale);
      if (result && result.success) {
        console.log('Receipt queued for printing.');
      } else {
        console.error('Failed to queue receipt for printing', result && result.error);
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
    }
  }

  if (!sale) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6 bg-background">
      <div className="flex justify-end gap-2">
        <SaleReconciliationDialog
          sale={sale}
          onSuccess={() => {
            fetchSale(id);
            fetchReconciliations();
          }}
        />
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Receipt
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-2xl font-semibold text-primary">Sale Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <InfoItem icon={<UserIcon className="w-5 h-5" />} label="Sale Type" value={sale.saleType} />
              <InfoItem icon={<CreditCardIcon className="w-5 h-5" />} label="Net Amount" value={`KES ${Number(sale.netTotalAmount ?? sale.totalAmount ?? 0).toFixed(2)}`} />
              <InfoItem icon={<CreditCardIcon className="w-5 h-5" />} label="Transaction Cost" value={`KES ${Number(sale.transactionCost || 0).toFixed(2)}`} />
              <InfoItem icon={<CreditCardIcon className="w-5 h-5" />} label="Payment Method" value={formatPaymentBreakdown(sale)} />
              <InfoItem icon={<CalendarIcon className="w-5 h-5" />} label="Date" value={new Date(sale.createdAt).toLocaleString()} />
              <InfoItem icon={<ShoppingBasketIcon className="w-5 h-5" />} label="Items" value={sale.totalItems.toString()} />
              <InfoItem icon={<TagIcon className="w-5 h-5" />} label="Type" value={sale.fullfilmentType} />
              <InfoItem
                icon={<TagIcon className="w-5 h-5" />}
                label="Status"
                value={<Badge variant={sale.status === 'voided' ? 'destructive' : 'secondary'}>{sale.status || 'posted'}</Badge>}
              />
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
                <TableHead>Remaining Returnable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {sale.items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.conversionFactor}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>KES {Number(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell>KES {Number(item.subtotal).toFixed(2)}</TableCell>
                    <TableCell>KES {Number(item.discount).toFixed(2)}</TableCell>
                    <TableCell>{sale.remainingReturnableByLine?.[item._id] ?? item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ReconciliationHistory reconciliations={reconciliations} />
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
