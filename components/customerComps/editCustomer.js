import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function EditCustomer({ customer, onEditSuccess }) {
  const [editedCustomer, setEditedCustomer] = useState({ ...customer });
  const [name, setName] = useState(customer.name)
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedCustomer(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleInputs = {
    handleName: (value) => setName(value)
  }

  console.log(name)

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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          onClick={(e) => {
            // Prevent the click from closing the dropdown
            e.preventDefault();
            setIsOpen(true);
          }}
        >
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Customer</SheetTitle>
          <SheetDescription>
            Make changes to customer information here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} >
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <input type="text" value={name} onChange={(e) => {handleInputs.handleName(e.target.value)}} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phoneNumber" className="text-right">
                Phone
              </Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={editedCustomer.phoneNumber}
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
                value={editedCustomer.address}
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
                value={editedCustomer.balance}
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
                checked={editedCustomer.credit}
                onCheckedChange={(checked) => setEditedCustomer(prev => ({ ...prev, credit: checked }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                name="status"
                value={editedCustomer.status}
                onValueChange={(value) => setEditedCustomer(prev => ({ ...prev, status: value }))}
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
            <Button type="submit" disabled={isEditing}>
              {isEditing ? 'Updating...' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}