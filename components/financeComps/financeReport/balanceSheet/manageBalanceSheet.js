import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useWsinfoStore from '@/stores/wsinfo';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "@/components/ui/use-toast";

export default function ManageBalanceSheet({ fetchBalanceSheets, initialData = null }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [balanceSheetData, setBalanceSheetData] = useState(initialData || {
    _id: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    assets: {
      cashAndBankBalances: 0,
      accountsReceivable: 0,
      inventory: 0,
      prepaidExpenses: 0,
      otherCurrentAssets: 0,
      totalCurrentAssets: 0,
      fixedAssets: 0,
      totalAssets: 0
    },
    liabilities: {
      accountsPayable: 0,
      shortTermLoans: 0,
      otherCurrentLiabilities: 0,
      totalCurrentLiabilities: 0,
      longTermLoans: 0,
      totalLiabilities: 0
    },
    equity: {
      ownerCapital: 0,
      retainedEarnings: 0,
      totalEquity: 0
    }
  });
  const [storeNo, setStoreNo] = useState("");
  const store = useWsinfoStore((state) => state.wsinfo);

  useEffect(() => {
    const storeNo = store.storeNo;
    if (storeNo) {
      setStoreNo(storeNo);
      // If this is a new entry, generate a new ID
      if (!initialData) {
        setBalanceSheetData(prev => ({
          ...prev,
          _id: `${storeNo}:${uuidv4()}`,
          storeNo: storeNo
        }));
      }
    }
  }, [store.storeNo, initialData]);

  const handleInputChange = (e, section, field) => {
    const { value } = e.target;
    setBalanceSheetData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const calculateTotals = () => {
    const updatedData = { ...balanceSheetData };
    
    // Calculate total current assets
    updatedData.assets.totalCurrentAssets = 
      updatedData.assets.cashAndBankBalances +
      updatedData.assets.accountsReceivable +
      updatedData.assets.inventory +
      updatedData.assets.prepaidExpenses +
      updatedData.assets.otherCurrentAssets;

    // Calculate total assets
    updatedData.assets.totalAssets = 
      updatedData.assets.totalCurrentAssets +
      updatedData.assets.fixedAssets;

    // Calculate total current liabilities
    updatedData.liabilities.totalCurrentLiabilities = 
      updatedData.liabilities.accountsPayable +
      updatedData.liabilities.shortTermLoans +
      updatedData.liabilities.otherCurrentLiabilities;

    // Calculate total liabilities
    updatedData.liabilities.totalLiabilities = 
      updatedData.liabilities.totalCurrentLiabilities +
      updatedData.liabilities.longTermLoans;

    // Calculate total equity
    updatedData.equity.totalEquity = 
      updatedData.equity.ownerCapital +
      updatedData.equity.retainedEarnings;

    setBalanceSheetData(updatedData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Ensure totals are calculated before submission
    calculateTotals();

    try {
      const operation = initialData ? 'updateBalanceSheet' : 'createBalanceSheetEntry';
      const result = await window.electronAPI.realmOperation(operation, balanceSheetData);
      
      if (result.success) {
        toast({
          title: "Success",
          description: initialData 
            ? "Balance Sheet updated successfully!" 
            : "Balance Sheet created successfully!"
        });
        
        // Refresh the list of balance sheets if a fetch function is provided
        if (fetchBalanceSheets) {
          fetchBalanceSheets();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error managing balance sheet:', error);
      toast({
        title: "Error",
        description: "Failed to manage balance sheet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant={initialData ? "outline" : "default"}>
          {initialData ? "Edit" : "Create Balance Sheet"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initialData ? "Edit Balance Sheet" : "Create New Balance Sheet"}</SheetTitle>
          <SheetDescription>
            Manage your financial position details
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Description</Label>
              <Input 
                value={balanceSheetData.description} 
                onChange={(e) => setBalanceSheetData(prev => ({
                  ...prev, 
                  description: e.target.value
                }))}
                placeholder="Balance Sheet Description"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input 
                type="date" 
                value={balanceSheetData.date.split('T')[0]} 
                onChange={(e) => setBalanceSheetData(prev => ({
                  ...prev, 
                  date: new Date(e.target.value).toISOString()
                }))}
              />
            </div>
          </div>

          {/* Assets Section */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Assets</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cash and Bank Balances</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.assets.cashAndBankBalances}
                  onChange={(e) => handleInputChange(e, 'assets', 'cashAndBankBalances')}
                />
              </div>
              <div>
                <Label>Accounts Receivable</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.assets.accountsReceivable}
                  onChange={(e) => handleInputChange(e, 'assets', 'accountsReceivable')}
                />
              </div>
              <div>
                <Label>Inventory</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.assets.inventory}
                  onChange={(e) => handleInputChange(e, 'assets', 'inventory')}
                />
              </div>
              <div>
                <Label>Prepaid Expenses</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.assets.prepaidExpenses}
                  onChange={(e) => handleInputChange(e, 'assets', 'prepaidExpenses')}
                />
              </div>
              <div>
                <Label>Other Current Assets</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.assets.otherCurrentAssets}
                  onChange={(e) => handleInputChange(e, 'assets', 'otherCurrentAssets')}
                />
              </div>
              <div>
                <Label>Fixed Assets</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.assets.fixedAssets}
                  onChange={(e) => handleInputChange(e, 'assets', 'fixedAssets')}
                />
              </div>
            </div>
          </div>

          {/* Liabilities Section */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Liabilities</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Accounts Payable</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.liabilities.accountsPayable}
                  onChange={(e) => handleInputChange(e, 'liabilities', 'accountsPayable')}
                />
              </div>
              <div>
                <Label>Short-Term Loans</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.liabilities.shortTermLoans}
                  onChange={(e) => handleInputChange(e, 'liabilities', 'shortTermLoans')}
                />
              </div>
              <div>
                <Label>Other Current Liabilities</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.liabilities.otherCurrentLiabilities}
                  onChange={(e) => handleInputChange(e, 'liabilities', 'otherCurrentLiabilities')}
                />
              </div>
              <div>
                <Label>Long-Term Loans</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.liabilities.longTermLoans}
                  onChange={(e) => handleInputChange(e, 'liabilities', 'longTermLoans')}
                />
              </div>
            </div>
          </div>

          {/* Equity Section */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Equity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Owner's Capital</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.equity.ownerCapital}
                  onChange={(e) => handleInputChange(e, 'equity', 'ownerCapital')}
                />
              </div>
              <div>
                <Label>Retained Earnings</Label>
                <Input 
                  type="number" 
                  value={balanceSheetData.equity.retainedEarnings}
                  onChange={(e) => handleInputChange(e, 'equity', 'retainedEarnings')}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-4">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? 'Saving...' : 'Save Balance Sheet'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
