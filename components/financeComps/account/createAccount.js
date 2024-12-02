import React, { useEffect, useState } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function CreateAccount({ fetchAccounts }) {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    _id: '',
    name: '',
    accountNumber: '',
    accountType: '',
    balance: '',
  });
  const [storeNo, setStoreNo] = useState("")
  const store = useWsinfoStore((state) => state.wsinfo);

  useEffect(() => {
    const storeNo = store.storeNo;
    if (storeNo) {
      setStoreNo(storeNo)
    }
  }, [store.storeNo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAccountTypeChange = (value) => {
    setNewAccount(prev => ({
      ...prev,
      accountType: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingAccount(true);
    try {
      const accountData = {
        ...newAccount,
        _id: `${storeNo}:${uuidv4()}`,
        balance: parseInt(newAccount.balance),
        storeNo: `${storeNo}`
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
          accountType: '',
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
              <Label htmlFor="accountType" className="text-right">
                Account Type
              </Label>
              <Select 
                name="accountType"
                value={newAccount.accountType} 
                onValueChange={handleAccountTypeChange}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Account Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="Legible">Legible</SelectItem>
                </SelectContent>
              </Select>
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
