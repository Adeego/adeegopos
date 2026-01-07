import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Smartphone, CreditCard, UserCheck, Truck, Loader2, Phone, CheckCircle2, XCircle, Clock } from 'lucide-react';
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
  note,
  setNote,
  servedBy,
  change,
  totalAmount,
}) {
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollingRef = useRef(null);
  const pollCountRef = useRef(0);

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
        setPaymentMethod('MPESA');
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
        setPaymentMethod('MPESA');
        
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
                <Select name="payment" value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <span className="flex items-center">
                        <DollarSign className="mr-2 h-4 w-4 text-green-500" />
                        Cash
                      </span>
                    </SelectItem>
                    <SelectItem value="MPESA">
                      <span className="flex items-center">
                        <Smartphone className="mr-2 h-4 w-4 text-blue-500" />
                        M-Pesa
                      </span>
                    </SelectItem>
                    <SelectItem value="CREDIT">
                      <span className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4 text-purple-500" />
                        Credit
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  className="text-lg"
                />
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
