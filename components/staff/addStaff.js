import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function AddStaff({ fetchStaff }) {
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const [newStaff, setNewStaff] = useState({
    _id: uuidv4(),
    firstName: '',
    lastName: '',
    phoneNumber: '',
    role: '',
    salary: '',
    passcode: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setNewStaff(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingStaff(true);
    try {
      const staffData = {
        ...newStaff,
        salary: parseFloat(newStaff.salary),
      };
      const result = await window.electronAPI.realmOperation('createStaff', staffData);
      if (result.success) {
        toast({
          title: "Success",
          description: "Staff member added successfully!",
        });
        fetchStaff(); // Refresh the staff list
        setNewStaff({
          _id: uuidv4(),
          firstName: '',
          lastName: '',
          phoneNumber: '',
          role: '',
          salary: '',
          passcode: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: "Error",
        description: "Failed to add staff member. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingStaff(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Add Staff</Button>
      </SheetTrigger>
      <SheetContent className="xl:max-w-[500px]">
        <ScrollArea className="h-[97vh] rounded-md border p-4 overscroll-none">
          <SheetHeader>
            <SheetTitle>Add New Staff Member</SheetTitle>
            <SheetDescription>
              Fill in the details to add a new staff member.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="firstName" className="text-right">First Name</Label>
                <Input id="firstName" name="firstName" value={newStaff.firstName} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="lastName" className="text-right">Last Name</Label>
                <Input id="lastName" name="lastName" value={newStaff.lastName} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phoneNumber" className="text-right">Phone</Label>
                <Input id="phoneNumber" name="phoneNumber" value={newStaff.phoneNumber} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Role</Label>
                <Select
                  name="role"
                  value={newStaff.role}
                  onValueChange={(value) => setNewStaff(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Cashier">Cashier</SelectItem>
                    <SelectItem value="Sales Associate">Sales Associate</SelectItem>
                    <SelectItem value="Stock Clerk">Stock Clerk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="salary" className="text-right">Salary</Label>
                <Input id="salary" name="salary" type="number" value={newStaff.salary} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="passcode" className="text-right">Passcode</Label>
                <Input id="passcode" name="passcode" type="password" value={newStaff.passcode} onChange={handleInputChange} className="col-span-3" />
              </div>
            </div>
            <SheetFooter>
              <SheetClose>
                <Button type="submit" disabled={isAddingStaff}>
                  {isAddingStaff ? 'Adding...' : 'Add Staff Member'}
                </Button>
              </SheetClose>
            </SheetFooter>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
