import React, {useState} from 'react'
import { v4 as uuidv4 } from 'uuid';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function AddSupplier({fetchSuppliers}) {
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

  // New supplier state
  const [newSupplier, setNewSupplier] = useState({
    _id: '',
    name: '',
    phoneNumber: '',
    address: '',
    balance: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSupplier(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingSupplier(true);
    try {
        const supplierData = {
          ...newSupplier,
          _id: `24091324:${uuidv4()}`,
          balance: parseInt(newSupplier.balance),
          storeNo: "24091324"
        };
        console.log(supplierData);
        const result = await window.electronAPI.realmOperation('createSupplier', supplierData);
        if (result.success) {
            toast({
                title: "Success",
                description: "Supplier created successfully!",
            });
            fetchSuppliers(); // Refresh the supplier list
            setNewSupplier({
                _id: uuidv4(),
                name: '',
                phoneNumber: '',
                address: '',
                balance: '',
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error creating supplier:', error);
        toast({
            title: "Error",
            description: "Failed to create supplier. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsAddingSupplier(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Add Supplier</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Supplier</SheetTitle>
          <SheetDescription>
            Fill in the details to add a new supplier.
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
                value={newSupplier.name}
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
                value={newSupplier.phoneNumber}
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
                value={newSupplier.address}
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
                value={newSupplier.balance}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <SheetFooter>
              <SheetClose >
                  <Button type="submit" disabled={isAddingSupplier}>
                    {isAddingSupplier ? 'Adding...' : 'Add Supplier'}
                  </Button>
              </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
