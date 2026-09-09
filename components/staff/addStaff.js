import React, { useEffect, useState } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from "@/components/ui/use-toast";
import { UserPlus } from 'lucide-react';
import { ACCESS_PRESETS, ACCESS_VERSION, can } from '@/lib/rbac';
import ModuleAccessEditor from '@/components/staff/moduleAccessEditor';

const presetRoles = {
  seller: ['seller'],
  cashier: ['cashier'],
  stock_manager: ['stock_manager'],
  bookkeeper: ['bookkeeper'],
  manager: ['operator'],
};

const emptyStaff = () => ({
  _id: '', firstName: '', lastName: '', phoneNumber: '', balance: 0,
  role: 'Seller', roles: ['seller'], accessVersion: ACCESS_VERSION,
  accessPreset: 'seller', moduleAccess: { ...ACCESS_PRESETS.seller.moduleAccess },
  isOwner: false, salary: '', passcode: '', storeNo: '',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

export default function AddStaff({ fetchStaff }) {
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const currentStaff = useStaffStore((state) => state.staff);
  const [storeNo, setStoreNo] = useState("");

  const [newStaff, setNewStaff] = useState(emptyStaff);

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
    if (Object.keys(newStaff.moduleAccess).length === 0) {
      toast({
        title: "Module access required",
        description: "Assign at least one module before adding staff.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingStaff(true);
    try {
      const staffData = {
        ...newStaff,
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
        setNewStaff(emptyStaff());
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add staff member. Please try again.",
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
      <SheetContent className="overflow-y-auto sm:max-w-3xl">
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
            <ModuleAccessEditor
              moduleAccess={newStaff.moduleAccess}
              accessPreset={newStaff.accessPreset}
              actorIsOwner={currentStaff.isOwner}
              onChange={(moduleAccess, accessPreset) => setNewStaff((prev) => ({ ...prev, moduleAccess, accessPreset }))}
              onPresetChange={(accessPreset, moduleAccess) => {
                const roles = presetRoles[accessPreset] || ['seller'];
                setNewStaff((prev) => ({
                  ...prev,
                  accessPreset,
                  moduleAccess,
                  roles,
                  role: ACCESS_PRESETS[accessPreset]?.label || 'Custom Access',
                }));
              }}
            />
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
            <Button type="submit" disabled={isAddingStaff}>
              {isAddingStaff ? "Adding..." : "Add Staff Member"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
