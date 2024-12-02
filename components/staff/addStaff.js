import React, { useEffect, useState } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { UserPlus } from 'lucide-react';

export default function AddStaff({ fetchStaff }) {
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState("");

  const [newStaff, setNewStaff] = useState({
    _id: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    balance: 0,
    role: '',
    salary: '',
    passcode: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    const storeNo = wsinfo.storeNo;
    if (storeNo) {
      setStoreNo(storeNo)
    }
  }, [wsinfo.storeNo])

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
        _id: `${storeNo}:${uuidv4()}`,
        salary: parseFloat(newStaff.salary),
      };
      console.log(staffData)
      const result = await window.electronAPI.realmOperation('createStaff', staffData);
      if (result.success) {
        toast({
          title: "Success",
          description: "Staff member added successfully!",
        });
        fetchStaff();
        setNewStaff({
          _id: `${storeNo}:${uuidv4()}`,
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
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>Add New Staff Member</SheetTitle>
          <SheetDescription>
            Fill in the details to add a new staff member to your team.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={newStaff.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={newStaff.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                value={newStaff.phoneNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                name="role"
                value={newStaff.role}
                onValueChange={(value) =>
                  setNewStaff((prev) => ({ ...prev, role: value }))
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Operator">Operator</SelectItem>
                  <SelectItem value="Worker">Worker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary</Label>
                <Input
                  id="salary"
                  name="salary"
                  type="number"
                  value={newStaff.salary}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Balance</Label>
                <Input
                  id="balance"
                  name="balance"
                  type="number"
                  value={newStaff.balance}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                name="passcode"
                type="password"
                value={newStaff.passcode}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="submit" disabled={isAddingStaff}>
                {isAddingStaff ? "Adding..." : "Add Staff Member"}
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
