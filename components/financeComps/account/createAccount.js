import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function CreateAccount({ fetchAccounts }) {
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // New account state
  const [newAccount, setNewAccount] = useState({
    _id: '',
    name: '',
    accountNumber: '',
    bank: '',
    balance: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingAccount(true);
    try {
      const accountData = {
        ...newAccount,
        _id: `24091324:${uuidv4()}`,
        balance: parseInt(newAccount.balance),
        storeNo: "24091324"
      };
      console.log(accountData);
      const result = await window.electronAPI.realmOperation('createAccount', accountData);
      if (result.success) {
        toast({
          title: "Success",
          description: "Account created successfully!",
        });
        fetchAccounts(); // Refresh the account list
        setNewAccount({
          _id: uuidv4(),
          name: '',
          accountNumber: '',
          bank: '',
          balance: '',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        title: "Error",
        description: "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingAccount(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Add Account</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Account</SheetTitle>
          <SheetDescription>
            Fill in the details to add a new account.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                value={newAccount.name}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="accountNumber" className="text-right">
                Account Number
              </Label>
              <Input
                id="accountNumber"
                name="accountNumber"
                value={newAccount.accountNumber}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bank" className="text-right">
                Bank
              </Label>
              <Input
                id="bank"
                name="bank"
                value={newAccount.bank}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="balance" className="text-right">
                Balance
              </Label>
              <Input
                id="balance"
                name="balance"
                type="number"
                value={newAccount.balance}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <SheetFooter>
            <SheetClose>
              <Button type="submit" disabled={isAddingAccount}>
                {isAddingAccount ? 'Adding...' : 'Add Account'}
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}