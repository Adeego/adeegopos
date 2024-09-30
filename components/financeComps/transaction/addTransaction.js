import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "@/components/ui/use-toast";

export default function AddTransaction({ fetchTransactions }) {
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);

  // New transaction state
  const [newTransaction, setNewTransaction] = useState({
    _id: '',
    description: '',
    amount: '',
    date: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTransaction(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingTransaction(true);
    try {
      const transactionData = {
        ...newTransaction,
        _id: `24091324:${uuidv4()}`,
        amount: parseInt(newTransaction.amount),
        date: new Date(newTransaction.date).toISOString(),
      };
      console.log(transactionData);
      const result = await window.electronAPI.realmOperation('createTransaction', transactionData);
      if (result.success) {
        toast({
          title: "Success",
          description: "Transaction recorded successfully!",
        });
        fetchTransactions(); // Refresh the transaction list
        setNewTransaction({
          _id: uuidv4(),
          description: '',
          amount: '',
          date: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
      toast({
        title: "Error",
        description: "Failed to record transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingTransaction(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Add Transaction</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Record New Transaction</SheetTitle>
          <SheetDescription>
            Fill in the details to record a new transaction.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                name="description"
                value={newTransaction.description}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                value={newTransaction.amount}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={newTransaction.date}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <SheetFooter>
            <SheetClose>
              <Button type="submit" disabled={isAddingTransaction}>
                {isAddingTransaction ? 'Recording...' : 'Record Transaction'}
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}