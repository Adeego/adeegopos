import React, {useEffect, useState} from 'react'
import { v4 as uuidv4 } from 'uuid';
import useWsinfoStore from '@/stores/wsinfo';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function AddCustomer({fetchCustomers}) {
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    _id: '',
    name: '',
    phoneNumber: '',
    address: '',
    balance: '',
    credit: false,
    status: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    const { name, value, type, checked } = e.target;
    setNewCustomer(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingCustomer(true);
    try {
        const customerData = {
          ...newCustomer,
          _id: `${storeNo}:${uuidv4()}`,
          balance: parseInt(newCustomer.balance),
          storeNo: `${storeNo}`
        };
        console.log(customerData);
        const result = await window.electronAPI.realmOperation('createCustomer', customerData);
        if (result.success) {
            toast({
                title: "Success",
                description: "Customer created successfully!",
            });
            fetchCustomers(); // Refresh the customer list
            setNewCustomer({
                _id: uuidv4(),
                name: '',
                phoneNumber: '',
                address: '',
                balance: '',
                credit: false,
                status: ''
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error creating customer:', error);
        toast({
            title: "Error",
            description: "Failed to create customer. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsAddingCustomer(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Add Customer</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Customer</SheetTitle>
          <SheetDescription>
            Fill in the details to add a new customer.
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
                value={newCustomer.name}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phoneNumber" className="text-right">
                Phone
              </Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={newCustomer.phoneNumber}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <Input
                id="address"
                name="address"
                value={newCustomer.address}
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
                value={newCustomer.balance}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="credit" className="text-right">
                Credit
              </Label>
              <Checkbox
                id="credit"
                name="credit"
                checked={newCustomer.credit}
                onCheckedChange={(checked) => setNewCustomer(prev => ({ ...prev, credit: checked }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="disciplinary" className="text-right">
                Status
              </Label>
              <Select
                name="disciplinary"
                value={newCustomer.status}
                onValueChange={(value) => setNewCustomer(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Neutral">Neutral</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Bad">Bad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter>
              <SheetClose >
                  <Button type="submit" disabled={isAddingCustomer}>
                    {isAddingCustomer ? 'Adding...' : 'Add Customer'}
                  </Button>
              </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
