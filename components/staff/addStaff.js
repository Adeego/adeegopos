import React, { useEffect, useState } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { UserPlus } from 'lucide-react';
import { can, getPrimaryRole, getRoleLabel, normalizeRoles, ROLE_OPTIONS } from '@/lib/rbac';

export default function AddStaff({ fetchStaff }) {
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const currentStaff = useStaffStore((state) => state.staff);
  const [storeNo, setStoreNo] = useState("");

  const [newStaff, setNewStaff] = useState({
    _id: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    balance: 0,
    role: '',
    roles: [],
    salary: '',
    passcode: '',
    storeNo: '',
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

  const handleRoleToggle = (role, checked) => {
    setNewStaff((prev) => {
      const nextRoles = checked
        ? [...prev.roles, role]
        : prev.roles.filter((item) => item !== role);
      const normalizedRoles = normalizeRoles(nextRoles);
      return {
        ...prev,
        roles: normalizedRoles,
        role: getRoleLabel(getPrimaryRole(normalizedRoles)),
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (normalizeRoles(newStaff.roles).length === 0) {
      toast({
        title: "Role required",
        description: "Assign at least one role before adding staff.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingStaff(true);
    try {
      const staffData = {
        ...newStaff,
        roles: normalizeRoles(newStaff.roles),
        role: getRoleLabel(getPrimaryRole(newStaff.roles)),
        _id: `${storeNo}:${uuidv4()}`,
        salary: parseFloat(newStaff.salary),
        storeNo: storeNo,
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
          _id: '',
          firstName: '',
          lastName: '',
          phoneNumber: '',
          balance: 0,
          role: '',
          roles: [],
          salary: '',
          passcode: '',
          storeNo: '',
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

  if (!can(currentStaff, 'staff:manageRoles')) {
    return null;
  }

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
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                {ROLE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newStaff.roles.includes(option.value)}
                      onCheckedChange={(checked) => handleRoleToggle(option.value, checked === true)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
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
