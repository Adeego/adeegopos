import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, UserCheck, Truck, Loader2, Phone, CheckCircle2, XCircle, Clock, Split, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const MPESA_API_URL = 'https://adeego.store';

function SaleDetailsDialog({
  open,
  onOpenChange,
  paymentMethod,
  setPaymentMethod,
  saleType,
  setSaleType,
  fulfillmentType,
  setFulfillmentType,
  onCompleteSale,
  amountPaid,
  setAmountPaid,
  transactionCost,
  setTransactionCost,
  paymentBreakdown,
  setPaymentBreakdown,
  note,
  setNote,
  servedBy,
  change,
  totalAmount,
  cashierAccounts = [],
  buildPaymentEntry,
  buildDefaultPaymentBreakdown,
}) {
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollingRef = useRef(null);
  const pollCountRef = useRef(0);
  const hybridTotal = (paymentBreakdown || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const hybridRemaining = Number(((Number(totalAmount) || 0) - hybridTotal).toFixed(2));
  const paymentOptions = [
    ...cashierAccounts.map((account) => ({
      value: account._id,
      label: account.name,
      account,
    })),
    { value: 'CREDIT', label: 'Credit' },
  ];
  const canUseHybrid = paymentOptions.length > 1;

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    if (value === 'HYBRID' && (!Array.isArray(paymentBreakdown) || paymentBreakdown.length === 0)) {
      setPaymentBreakdown(buildDefaultPaymentBreakdown ? buildDefaultPaymentBreakdown(cashierAccounts) : []);
    }
  };

  const updatePaymentSplit = (index, field, value) => {
    if (field === 'method') {
      setPaymentBreakdown((current) => (
        (current || []).map((payment, paymentIndex) => {
          if (paymentIndex !== index) {
            return payment;
          }

          const nextPayment = buildPaymentEntry
            ? buildPaymentEntry(value, {
                amount: payment.amount,
                transactionCost: payment.transactionCost,
              })
            : { ...payment, method: value };

          return nextPayment;
        })
      ));
      return;
    }

    setPaymentBreakdown((current) => (
      (current || []).map((payment, paymentIndex) => (
        paymentIndex === index ? { ...payment, [field]: value } : payment
      ))
    ));
  };

  // Cleanup polling on unmount or dialog close
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Stop polling when dialog closes
  useEffect(() => {
    if (!open && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [open]);

  const checkPaymentStatus = async (checkoutId) => {
    try {
      const response = await fetch(`${MPESA_API_URL}/mpesa/transaction/${checkoutId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('M-Pesa Status Check:', data);

      if (data.ResultCode === '0' || data.status === 'completed' || data.success) {
        // Payment successful
        setPaymentConfirmed(true);
        setMpesaStatus({ type: 'confirmed', message: 'Payment confirmed!' });
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        // Auto-fill amount paid
        const amount = totalAmount || amountPaid;
        if (amount) {
          setAmountPaid(String(Math.ceil(amount)));
        }
        return true;
      } else if (data.ResultCode === '1032' || data.status === 'cancelled') {
        // User cancelled
        setMpesaStatus({ type: 'error', message: 'Payment was cancelled by user' });
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return false;
      } else if (data.ResultCode && data.ResultCode !== '0') {
        // Payment failed
        setMpesaStatus({ type: 'error', message: data.ResultDesc || 'Payment failed' });
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return false;
      }
      // Still pending
      return null;
    } catch (error) {
      console.error('Payment status check error:', error);
      return null;
    }
  };

  const startPolling = (checkoutId) => {
    pollCountRef.current = 0;
    const maxPolls = 24; // Poll for max 2 minutes (24 * 5 seconds)
    
    pollingRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      
      if (pollCountRef.current > maxPolls) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setMpesaStatus({ type: 'error', message: 'Payment timeout. Please try again.' });
        return;
      }

      const result = await checkPaymentStatus(checkoutId);
      if (result !== null) {
        // Payment resolved (success or failure)
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 5000); // Check every 5 seconds
  };

  const handleMpesaPrompt = async () => {
    if (!mpesaPhone || mpesaPhone.length < 9) {
      setMpesaStatus({ type: 'error', message: 'Please enter a valid phone number' });
      return;
    }

    const amount = totalAmount || amountPaid;
    if (!amount || amount <= 0) {
      setMpesaStatus({ type: 'error', message: 'Invalid amount' });
      return;
    }

    setMpesaLoading(true);
    setMpesaStatus(null);

    try {
      const response = await fetch(`${MPESA_API_URL}/mpesa/stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: mpesaPhone.startsWith('254') ? mpesaPhone : `254${mpesaPhone.replace(/^0/, '')}`,
          amount: Math.ceil(amount),
        }),
      });

      const data = await response.json();
      console.log('M-Pesa STK Response:', { status: response.status, data });

      if (response.ok && (data.ResponseCode === '0' || data.success || data.CheckoutRequestID)) {
        const checkoutId = data.CheckoutRequestID || data.checkout_request_id;
        setCheckoutRequestId(checkoutId);
        setMpesaStatus({ type: 'pending', message: 'STK Push sent! Waiting for payment...' });
        
        // Start background polling for payment confirmation
        if (checkoutId) {
          startPolling(checkoutId);
        }
      } else {
        const errorMsg = data.errorMessage || data.message || data.ResponseDescription || data.error || JSON.stringify(data);
        console.error('M-Pesa STK Error:', errorMsg);
        setMpesaStatus({ type: 'error', message: errorMsg });
      }
    } catch (error) {
      console.error('M-Pesa STK Push error:', error);
      setMpesaStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setMpesaLoading(false);
    }
  };
  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Sale Details</DialogTitle>
          <DialogDescription>Fill in the necessary details for this sale</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="w-full">
            <CardContent className="grid gap-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="payment" className="text-base font-semibold">Payment Method</Label>
                <Select name="payment" value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                  <SelectTrigger id="payment">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashierAccounts.map((account) => (
                      <SelectItem key={account._id} value={account._id}>
                        <span className="flex items-center">
                          <Wallet className="mr-2 h-4 w-4 text-green-500" />
                          {account.name}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="CREDIT">
                      <span className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4 text-purple-500" />
                        Credit
                      </span>
                    </SelectItem>
                    {canUseHybrid && (
                      <SelectItem value="HYBRID">
                        <span className="flex items-center">
                          <Split className="mr-2 h-4 w-4 text-orange-500" />
                          Hybrid
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === 'HYBRID' && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Hybrid Split</Label>
                    <span className={hybridRemaining === 0 ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                      Remaining: KES {hybridRemaining.toFixed(2)}
                    </span>
                  </div>
                  {(paymentBreakdown || []).map((payment, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Select
                        value={payment.method === 'CREDIT' ? 'CREDIT' : payment.accountId || ''}
                        onValueChange={(value) => updatePaymentSplit(index, 'method', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        value={payment.amount}
                        onChange={(event) => updatePaymentSplit(index, 'amount', event.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Cost"
                        value={payment.transactionCost}
                        onChange={(event) => updatePaymentSplit(index, 'transactionCost', event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-base font-semibold">M-Pesa Payment</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="tel"
                      placeholder="07XXXXXXXX"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleMpesaPrompt}
                    disabled={mpesaLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {mpesaLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Prompt'
                    )}
                  </Button>
                </div>
                {mpesaStatus && (
                  <div className={`flex items-center space-x-2 text-sm ${
                    mpesaStatus.type === 'confirmed' ? 'text-green-600' : 
                    mpesaStatus.type === 'pending' ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {mpesaStatus.type === 'confirmed' && <CheckCircle2 className="h-4 w-4" />}
                    {mpesaStatus.type === 'pending' && <Clock className="h-4 w-4 animate-pulse" />}
                    {mpesaStatus.type === 'error' && <XCircle className="h-4 w-4" />}
                    <p>{mpesaStatus.message}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Fulfillment Type</Label>
                <RadioGroup value={fulfillmentType} onValueChange={setFulfillmentType} className="flex flex-row items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="WALK-IN-CLIENT" id="walk-in" />
                    <Label htmlFor="walk-in" className="flex items-center cursor-pointer">
                      <UserCheck className="mr-2 h-4 w-4 text-blue-500" />
                      Walk-in Client
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DELIVERY" id="delivery" />
                    <Label htmlFor="delivery" className="flex items-center cursor-pointer">
                      <Truck className="mr-2 h-4 w-4 text-purple-500" />
                      Delivery
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="served-by" className="text-base font-semibold">Served By</Label>
                <Input 
                  id="served-by" 
                  type="text" 
                  value={servedBy} 
                  readOnly 
                  className="bg-gray-100 font-semibold cursor-not-allowed text-gray-600"
                />
              </div>
            </CardContent>
          </Card>
          <Card className="w-full">
            <CardContent className="grid gap-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="served-by" className="text-base font-semibold">Change</Label>
                <Input 
                  id="served-by" 
                  type="number" 
                  value={change} 
                  readOnly 
                  className="bg-gray-100 font-semibold text-3xl p-6 cursor-not-allowed text-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount-paid" className="text-base font-semibold">Amount Paid</Label>
                <Input 
                  id="amount-paid" 
                  type="number" 
                  placeholder="Enter amount paid" 
                  value={amountPaid} 
                  onChange={(e) => setAmountPaid(e.target.value)}
                  readOnly={paymentMethod === 'HYBRID'}
                  className="text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transaction-cost" className="text-base font-semibold">Transaction Cost</Label>
                <Input
                  id="transaction-cost"
                  type="number"
                  min="0"
                  placeholder="Enter transaction cost"
                  value={transactionCost}
                  onChange={(e) => setTransactionCost(e.target.value)}
                  readOnly={paymentMethod === 'HYBRID'}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Net received: KES {(Math.max(0, (Number(totalAmount) || 0) - (Number(transactionCost) || 0))).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note" className="text-base font-semibold">Note</Label>
                <Textarea 
                  id="note" 
                  placeholder="Add any additional notes" 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              
            </CardContent>
          </Card>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCompleteSale}>Complete Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaleDetailsDialog;
