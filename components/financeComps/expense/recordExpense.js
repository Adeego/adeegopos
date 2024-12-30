import React, { useEffect, useState } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function RecordExpense({ fetchExpenses }) {
  const [isRecordingExpense, setIsRecordingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    _id: '',
    description: '',
    amount: '',
    date: '',
    account: '',
    accountId: '',
    expenseType: '',
    expenseTypeId: ''
  });
  const [accounts, setAccounts] = useState([])
  const [expenseType, setExpenseTypes] = useState([])
  const [storeNo, setStoreNo] = useState("")
  const store = useWsinfoStore((state) => state.wsinfo);

  // const expenseTypes = [
  //   'Rent and Utilities', 
  //   'Salaries and Wages', 
  //   'Transport and Fuel', 
  //   'Maintenace and Repairs', 
  //   'Other Expense'
  // ];

  useEffect(() => {
    const storeNo = store.storeNo;
    if (storeNo) {
      setStoreNo(storeNo)
    }
    fetchAccounts();
    fetchExpenseTypes();
  }, [store.storeNo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewExpense(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name, value) => {
    setNewExpense(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchExpenseTypes = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllExpenseTypes')
      if (result.success) {
        setExpenseTypes(result.expenseTypes)
      }
    } catch (error) {
      console.error(error);
    }
  }

  const fetchAccounts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllAccounts');
      if (result.success) {
        console.log(result.accounts)
        setAccounts(result.accounts || []); // Ensure accounts is always an array
      } else {
        setAccounts([]); // Set empty array if request fails
        console.error('Failed to fetch accounts:', result.error);
      }
    } catch (error) {
      setAccounts([]); // Set empty array on error
      console.error('Error fetching accounts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRecordingExpense(true);
    try {
      const expenseData = {
        ...newExpense,
        _id: `${storeNo}:${uuidv4()}`,
        amount: parseInt(newExpense.amount),
        date: new Date(newExpense.date).toISOString(),
        storeNo: `${storeNo}`
      };
      console.log(expenseData);
      const result = await window.electronAPI.realmOperation('createExpense', expenseData);
      if (result.success) {
        console.log(result);
        toast({
          title: "Success",
          description: "Expense recorded successfully!",
        });
        fetchExpenses();
        setNewExpense({
          _id: '',
          description: '',
          amount: '',
          date: '',
          account: '',
          accountId: '',
          expenseType: '',
          expenseTypeId: ''
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="account" className="text-right">
                Account
              </Label>
              <Select 
                name="account"
                value={newExpense.account} 
                onValueChange={(value) => {
                  const selectedAccount = accounts.find(a => a.name === value);
                  handleSelectChange('account', selectedAccount.name);
                  handleSelectChange('accountId', selectedAccount._id)
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account._id} value={account.name}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expenseType" className="text-right">
                Expense Type
              </Label>
              <Select 
                name="expenseType"
                value={newExpense.expenseType} 
                onValueChange={(value) => {
                  const selectedType = expenseType.find(t => t.name === value);
                  handleSelectChange('expenseType', selectedType.name);
                  handleSelectChange('expenseTypeId', selectedType._id);
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select expense type" />
                </SelectTrigger>
                <SelectContent>
                  {expenseType.map((type) => (
                    <SelectItem key={type._id} value={type.name}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
