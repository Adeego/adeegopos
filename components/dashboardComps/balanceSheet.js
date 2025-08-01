'use client'

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BalanceSheet = ({ sales, creditsGiven, creditsPaid }) => {
  const [previousDayClosing, setPreviousDayClosing] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [difference, setDifference] = useState(0);

  useEffect(() => {
    const total = sales + parseFloat(previousDayClosing) + creditsPaid - creditsGiven;
    setCalculatedTotal(total);
  }, [sales, previousDayClosing, creditsPaid, creditsGiven]);

  useEffect(() => {
    const diff = parseFloat(currentBalance) - calculatedTotal;
    setDifference(diff);
  }, [currentBalance, calculatedTotal]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Balance Register</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Daily Register Balance</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sales" className="text-right">
              Sales
            </Label>
            <Input id="sales" value={sales} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prev-closing" className="text-right">
              Previous Closing
            </Label>
            <Input
              id="prev-closing"
              type="number"
              value={previousDayClosing}
              onChange={(e) => setPreviousDayClosing(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="credits-paid" className="text-right">
              Credits Paid
            </Label>
            <Input id="credits-paid" value={creditsPaid} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="credits-given" className="text-right">
              Credits Given
            </Label>
            <Input id="credits-given" value={creditsGiven} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="total" className="text-right">
              Total
            </Label>
            <Input id="total" value={calculatedTotal.toFixed(2)} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-balance" className="text-right">
              Current Balance
            </Label>
            <Input
              id="current-balance"
              type="number"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="difference" className="text-right">
              Difference
            </Label>
            <Input id="difference" value={difference.toFixed(2)} readOnly className={`col-span-3 ${difference === 0 ? 'bg-green-200' : 'bg-red-200'}`} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BalanceSheet;
