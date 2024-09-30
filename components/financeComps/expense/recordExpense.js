import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "@/components/ui/use-toast";

export default function RecordExpense({ fetchExpenses }) {
  const [isRecordingExpense, setIsRecordingExpense] = useState(false);

  // New expense state
  const [newExpense, setNewExpense] = useState({
    _id: '',
    description: '',
    amount: '',
    date: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewExpense(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRecordingExpense(true);
    try {
      const expenseData = {
        ...newExpense,
        _id: `24091324:${uuidv4()}`,
        amount: parseInt(newExpense.amount),
        date: new Date(newExpense.date).toISOString(),
      };
      console.log(expenseData);
      const result = await window.electronAPI.realmOperation('createExpense', expenseData);
      if (result.success) {
        toast({
          title: "Success",
          description: "Expense recorded successfully!",
        });
        fetchExpenses(); // Refresh the expense list
        setNewExpense({
          _id: uuidv4(),
          description: '',
          amount: '',
          date: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error recording expense:', error);
      toast({
        title: "Error",
        description: "Failed to record expense. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRecordingExpense(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Record Expense</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Record New Expense</SheetTitle>
          <SheetDescription>
            Fill in the details to record a new expense.
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
                value={newExpense.description}
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
                value={newExpense.amount}
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
                value={newExpense.date}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <SheetFooter>
            <SheetClose>
              <Button type="submit" disabled={isRecordingExpense}>
                {isRecordingExpense ? 'Recording...' : 'Record Expense'}
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}