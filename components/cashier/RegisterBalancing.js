'use client'

import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calculator, Wallet, Smartphone, CreditCard, RefreshCw, Save, Trash2, Clock, History, Lock } from 'lucide-react';
import useRegisterBalanceStore from '@/stores/registerBalanceStore';
import useStaffStore from '@/stores/staffStore';
import { useToast } from '@/components/ui/use-toast';

// Cash payment row - moved outside to prevent re-creation on each render
const CashRow = ({ today, todaySales, creditsPaid = 0, setOpeningBalance, setClosingBalance }) => {
  const opening = today.cash?.opening || 0;
  const sales = todaySales.cash || 0;
  const credits = creditsPaid;
  const expected = opening + sales + credits;
  const actual = today.cash?.closing || 0;
  const difference = actual - expected;
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4 text-green-600" />
          Cash
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Opening Balance</Label>
            <Input
              type="number"
              value={today.cash?.opening ?? ''}
              onChange={(e) => setOpeningBalance('cash', null, e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Today's Sales</Label>
            <Input
              value={sales.toFixed(2)}
              readOnly
              className="mt-1 bg-muted"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Credits Paid</Label>
            <Input
              value={credits.toFixed(2)}
              readOnly
              className="mt-1 bg-muted text-green-600"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Expected</Label>
            <Input
              value={expected.toFixed(2)}
              readOnly
              className="mt-1 bg-muted"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Closing Balance</Label>
            <Input
              type="number"
              value={today.cash?.closing ?? ''}
              onChange={(e) => setClosingBalance('cash', null, e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <div className="flex justify-between items-center w-full pb-2">
              <Label className="text-xs text-muted-foreground">Difference</Label>
              <Badge variant={difference === 0 ? 'success' : difference > 0 ? 'default' : 'destructive'}
                     className={difference === 0 ? 'bg-green-500' : difference > 0 ? 'bg-blue-500' : ''}>
                {difference >= 0 ? '+' : ''}{difference.toFixed(2)}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// M-Pesa payment row with phone and till sub-fields
const MpesaRow = ({ today, todaySales, creditsPaid = 0, setOpeningBalance, setClosingBalance }) => {
  // Phone sub-method
  const phoneOpening = today.mpesa?.phone?.opening || 0;
  const phoneSales = todaySales.phone || 0;
  const phoneExpected = phoneOpening + phoneSales;
  const phoneClosing = today.mpesa?.phone?.closing || 0;
  
  // Till sub-method
  const tillOpening = today.mpesa?.till?.opening || 0;
  const tillSales = todaySales.till || 0;
  const tillExpected = tillOpening + tillSales;
  const tillClosing = today.mpesa?.till?.closing || 0;
  
  // Credits paid via M-Pesa
  const credits = creditsPaid;
  
  // Combined M-Pesa totals (including credits)
  const totalOpening = phoneOpening + tillOpening;
  const totalSales = phoneSales + tillSales;
  const totalExpected = totalOpening + totalSales + credits;
  const totalClosing = phoneClosing + tillClosing;
  const totalDifference = totalClosing - totalExpected;
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-green-500" />
          M-Pesa
          <Badge variant="outline" className="ml-auto text-xs">
            Total: KES {totalClosing.toFixed(2)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone Sub-section */}
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="h-3 w-3 text-blue-600" />
            <span className="text-xs font-medium">Phone</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Opening</Label>
              <Input
                type="number"
                value={today.mpesa?.phone?.opening ?? ''}
                onChange={(e) => setOpeningBalance('mpesa', 'phone', e.target.value)}
                placeholder="0.00"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sales</Label>
              <Input
                value={phoneSales.toFixed(2)}
                readOnly
                className="mt-1 h-8 text-sm bg-muted"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Expected</Label>
              <Input
                value={phoneExpected.toFixed(2)}
                readOnly
                className="mt-1 h-8 text-sm bg-muted"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Closing</Label>
              <Input
                type="number"
                value={today.mpesa?.phone?.closing ?? ''}
                onChange={(e) => setClosingBalance('mpesa', 'phone', e.target.value)}
                placeholder="0.00"
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Till Sub-section */}
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-3 w-3 text-purple-600" />
            <span className="text-xs font-medium">Till</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Opening</Label>
              <Input
                type="number"
                value={today.mpesa?.till?.opening ?? ''}
                onChange={(e) => setOpeningBalance('mpesa', 'till', e.target.value)}
                placeholder="0.00"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sales</Label>
              <Input
                value={tillSales.toFixed(2)}
                readOnly
                className="mt-1 h-8 text-sm bg-muted"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Expected</Label>
              <Input
                value={tillExpected.toFixed(2)}
                readOnly
                className="mt-1 h-8 text-sm bg-muted"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Closing</Label>
              <Input
                type="number"
                value={today.mpesa?.till?.closing ?? ''}
                onChange={(e) => setClosingBalance('mpesa', 'till', e.target.value)}
                placeholder="0.00"
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Credits Paid via M-Pesa */}
        <div className="border rounded-lg p-3 bg-green-50">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-green-700">Credits Paid (M-Pesa)</span>
            <span className="text-sm font-semibold text-green-600">+ KES {credits.toFixed(2)}</span>
          </div>
        </div>

        {/* M-Pesa Summary */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Expected</span>
            <span className="font-semibold">KES {totalExpected.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">M-Pesa Difference</Label>
            <Badge variant={totalDifference === 0 ? 'success' : totalDifference > 0 ? 'default' : 'destructive'}
                   className={totalDifference === 0 ? 'bg-green-500' : totalDifference > 0 ? 'bg-blue-500' : ''}>
              {totalDifference >= 0 ? '+' : ''}{totalDifference.toFixed(2)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const RegisterBalancing = ({ todaySales = {}, creditsPaid = { cash: 0, mpesa: 0, total: 0 } }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const staff = useStaffStore((state) => state.staff);
  
  const {
    yesterday,
    today,
    createdAt,
    editHistory,
    isSaved,
    setOpeningBalance,
    setClosingBalance,
    saveBalances,
    carryForward,
    resetBalances
  } = useRegisterBalanceStore();

  // Check if user is admin
  const isAdmin = staff?.role === 'Admin';
  const staffName = staff?.firstName ? `${staff.firstName} ${staff.lastName || ''}`.trim() : 'Unknown';

  // Credits paid by method
  const creditsPaidCash = creditsPaid?.cash || 0;
  const creditsPaidMpesa = creditsPaid?.mpesa || 0;
  const totalCreditsPaid = creditsPaid?.total || (creditsPaidCash + creditsPaidMpesa);

  // Calculate totals
  const cashOpening = today.cash?.opening || 0;
  const mpesaPhoneOpening = today.mpesa?.phone?.opening || 0;
  const mpesaTillOpening = today.mpesa?.till?.opening || 0;
  const totalOpening = cashOpening + mpesaPhoneOpening + mpesaTillOpening;

  const cashSales = todaySales.cash || 0;
  const phoneSales = todaySales.phone || 0;
  const tillSales = todaySales.till || 0;
  const totalSales = cashSales + phoneSales + tillSales;
  const mpesaSales = phoneSales + tillSales;

  // Credits paid adds to the register (money coming in)
  const totalExpected = totalOpening + totalSales + totalCreditsPaid;

  const cashClosing = today.cash?.closing || 0;
  const mpesaPhoneClosing = today.mpesa?.phone?.closing || 0;
  const mpesaTillClosing = today.mpesa?.till?.closing || 0;
  const totalClosing = cashClosing + mpesaPhoneClosing + mpesaTillClosing;
  const mpesaClosing = mpesaPhoneClosing + mpesaTillClosing;

  const totalDifference = totalClosing - totalExpected;

  // Yesterday's M-Pesa totals
  const yesterdayMpesaClosing = (yesterday.mpesa?.phone?.closing || 0) + (yesterday.mpesa?.till?.closing || 0);

  const handleSave = () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can save register balances",
        variant: "destructive"
      });
      return;
    }
    saveBalances(staffName);
    toast({
      title: "Saved",
      description: "Register balances saved successfully"
    });
  };

  const handleCarryForward = () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can start a new day",
        variant: "destructive"
      });
      return;
    }
    carryForward(staffName);
    toast({
      title: "New Day Started",
      description: "Closing balances carried forward to today's opening"
    });
  };

  const handleReset = () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can reset register balances",
        variant: "destructive"
      });
      return;
    }
    resetBalances(staffName);
    toast({
      title: "Reset Complete",
      description: "All register balances have been reset"
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Calculator className="mr-2 h-4 w-4" />
          Balance Register
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Register Balancing
          </SheetTitle>
          <SheetDescription>
            {createdAt && (
              <span className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                Created: {formatDate(createdAt)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Admin Notice */}
          {!isAdmin && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-amber-700 text-sm">
                  <Lock className="h-4 w-4" />
                  <span>Only admins can save, edit, or delete balances</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Yesterday's Summary */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Yesterday's Closing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Cash</p>
                  <p className="font-semibold">{(yesterday.cash?.closing || 0).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">M-Pesa</p>
                  <p className="font-semibold">{yesterdayMpesaClosing.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Payment Methods */}
          <CashRow 
            today={today}
            todaySales={todaySales}
            creditsPaid={creditsPaidCash}
            setOpeningBalance={setOpeningBalance}
            setClosingBalance={setClosingBalance}
          />
          
          <MpesaRow 
            today={today}
            todaySales={todaySales}
            creditsPaid={creditsPaidMpesa}
            setOpeningBalance={setOpeningBalance}
            setClosingBalance={setClosingBalance}
          />

          <Separator />

          {/* Totals Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Opening</span>
                <span className="font-semibold">KES {totalOpening.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cash Sales</span>
                <span className="font-semibold">KES {cashSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">M-Pesa Sales</span>
                <span className="font-semibold">KES {mpesaSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credits Paid (Cash)</span>
                <span className="font-semibold text-green-600">+ KES {creditsPaidCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credits Paid (M-Pesa)</span>
                <span className="font-semibold text-green-600">+ KES {creditsPaidMpesa.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Total</span>
                <span className="font-semibold">KES {totalExpected.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cash Closing</span>
                <span className="font-semibold">KES {cashClosing.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">M-Pesa Closing</span>
                <span className="font-semibold">KES {mpesaClosing.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium">Total Difference</span>
                <Badge 
                  variant={totalDifference === 0 ? 'success' : totalDifference > 0 ? 'default' : 'destructive'}
                  className={`text-sm ${totalDifference === 0 ? 'bg-green-500' : totalDifference > 0 ? 'bg-blue-500' : ''}`}
                >
                  {totalDifference >= 0 ? '+' : ''}KES {totalDifference.toFixed(2)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Edit History */}
          {editHistory && editHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Edit History
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    {showHistory ? 'Hide' : 'Show'}
                  </Button>
                </CardTitle>
              </CardHeader>
              {showHistory && (
                <CardContent>
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {editHistory.slice().reverse().map((entry, index) => (
                        <div key={index} className="text-xs border-b pb-2 last:border-0">
                          <div className="flex justify-between items-start">
                            <Badge variant="outline" className="text-xs">
                              {entry.action}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            By: {entry.editedBy}
                          </p>
                          <p className="text-foreground">{entry.details}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          )}

          {/* Actions - Admin Only */}
          <div className="flex gap-2 pt-4">
            <Button 
              variant="default" 
              className="flex-1"
              onClick={handleSave}
              disabled={!isAdmin}
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleCarryForward}
              disabled={!isAdmin}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              New Day
            </Button>
            <Button 
              variant="destructive" 
              size="icon"
              onClick={handleReset}
              disabled={!isAdmin}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RegisterBalancing;
