import React, { useState, useEffect } from 'react';
import DeleteAccount from '@/components/financeComps/account/deleteAccount';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';

export default function AccountDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [account, setAccount] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAccountDetail();
    }
  }, [id]);

  const fetchAccountDetail = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAccountById', id);
      if (result.success) {
        setAccount(result.account);
      } else {
        console.error('Failed to fetch account details:', result.error);
        toast({
          description: 'Failed to fetch account details'
        });
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
      toast({
        description: 'Error fetching account details'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAccount({ ...account, [name]: value });
  };

  const handleAccountTypeChange = (value) => {
    setAccount({ ...account, accountType: value });
  };

  const handleSave = async () => {
    try {
      const result = await window.electronAPI.realmOperation('updateAccount', {
        ...account,
        updatedAt: new Date().toISOString(),
      });
      if (result.success) {
        setIsEditing(false);
        toast({
          description: 'Account details updated successfully'
        });
      } else {
        console.error('Failed to update account:', result.error);
        toast({
          description: 'Failed to update account details'
        });
      }
    } catch (error) {
      console.error('Error updating account:', error);
      toast({
        description: 'Error updating account details'
      });
    }
  };

  if (!account) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="w-full bg-white shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-2xl font-semibold text-gray-800">Account Details</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            This account was added on {new Date(account.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" value={account.name} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input id="accountNumber" name="accountNumber" value={account.accountNumber} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select 
                    name="accountType"
                    value={account.accountType} 
                    onValueChange={handleAccountTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Account Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank">Bank</SelectItem>
                      <SelectItem value="Legible">Legible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="balance">Balance</Label>
                  <Input id="balance" name="balance" type="number" value={account.balance} onChange={handleInputChange} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">NAME</div>
                  <div className="text-sm font-semibold text-gray-900">{account.name}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">ACCOUNT NUMBER</div>
                  <div className="text-sm font-semibold text-gray-900">{account.accountNumber}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">ACCOUNT TYPE</div>
                  <div className="text-sm font-semibold text-gray-900">{account.accountType}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">BALANCE</div>
                  <div className="text-sm font-semibold text-gray-900">{account.balance}</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 border-t border-gray-200 p-6">
          <div className="w-full flex justify-between">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)}>Edit</Button>
                <DeleteAccount accountId={account._id} accountName={account.name} />
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
