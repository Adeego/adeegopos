import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function Edit({ customer, onEditSuccess }) {
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phoneNumber: '',
        address: '',
        balance: '',
        credit: false,
        status: '',
      });
    const [isEditing, setIsEditing] = useState(false);
    // const [isOpen, setIsOpen] = useState(false);
    
      const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewCustomer(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
        }));
      };
    
      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsEditing(true);
        try {
          const customerData = {
            ...editedCustomer,
            balance: parseInt(editedCustomer.balance)
          };
          const result = await window.electronAPI.realmOperation('updateCustomer', customerData);
          if (result.success) {
            toast({
              title: "Success",
              description: "Customer updated successfully!",
            });
            onEditSuccess();
            setIsOpen(false);
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error('Error updating customer:', error);
          toast({
            title: "Error",
            description: "Failed to update customer. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsEditing(false);
        }
      };
    
      return (
        <div>
            <Sheet>
          <SheetTrigger asChild>
            <Button>Edit</Button>
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
                    <Button type="submit" disabled={isEditing}>
                      {isEditing ? 'Updating...' : 'Save Changes'}
                    </Button>
                  </SheetClose>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
        </div>
        
      )
}
