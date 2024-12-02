import React from 'react';
import { DollarSign, Smartphone, CreditCard, ShoppingBag, RotateCcw, UserCheck, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
}) {
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
                <Label className="text-base font-semibold">Sale Type</Label>
                <RadioGroup value={saleType} onValueChange={setSaleType} className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NEW SALE" id="new-sale" />
                    <Label htmlFor="new-sale" className="flex items-center cursor-pointer">
                      <ShoppingBag className="mr-2 h-4 w-4 text-green-500" />
                      New Sale
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="RETURN SALE" id="return-sale" />
                    <Label htmlFor="return-sale" className="flex items-center cursor-pointer">
                      <RotateCcw className="mr-2 h-4 w-4 text-orange-500" />
                      Return Sale
                    </Label>
                  </div>
                </RadioGroup>
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
