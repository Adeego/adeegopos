import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';

export default function StaffDetail() {
  const router = useRouter();
  const { id } = router.query;
  const {toast} = useToast();
  const [staff, setStaff] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchStaffDetail();
    }
  }, [id]);

  const fetchStaffDetail = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getStaffById', id);
      if (result.success) {
        setStaff(result.staff);
      } else {
        console.error('Failed to fetch staff details:', result.error);
        toast.error('');
        toast({
          description: 'Failed to fetch staff details'
        });
      }
    } catch (error) {
      console.error('Error fetching staff details:', error);
      toast({
        description: 'Error fetching staff details'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setStaff({ ...staff, [name]: value });
  };

  const handleRoleChange = (value) => {
    setStaff({ ...staff, role: value });
  };

  const handleSave = async () => {
    try {
      const result = await window.electronAPI.realmOperation('updateStaff', {
        ...staff,
        salary: parseFloat(staff.salary),
        updatedAt: new Date().toISOString(),
      });
      if (result.success) {
        setIsEditing(false);
        toast({
          description: 'Staff details updated successfully'
        });
      } else {
        console.error('Failed to update staff:', result.error);
        toast({
          description: 'Failed to update staff details'
        });
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      toast({
        description: 'Error updating staff details'
      });
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        const result = await window.electronAPI.realmOperation('deleteStaff', id);
        if (result.success) {
          toast({
            description: 'Staff member deleted successfully'
          });
          router.push('/staff');
        } else {
          console.error('Failed to delete staff:', result.error);
          toast({
            description: 'Failed to delete staff member'
          });
        }
      } catch (error) {
        console.error('Error deleting staff:', error);
        toast({
          description: 'Error deleting staff member', error
        });
      }
    }
  };

  if (!staff) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="w-full bg-white shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-2xl font-semibold text-gray-800">Staff Details</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            This staff member joined on {new Date(staff.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={staff.firstName} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={staff.lastName} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" value={staff.phoneNumber} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={staff.role} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Cashier">Cashier</SelectItem>
                      <SelectItem value="Accountant">Accountant</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Junior">Junior</SelectItem>
                      <SelectItem value="Delivery">Delivery</SelectItem>
                      <SelectItem value="Hand Man">Hand Man</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="salary">Salary</Label>
                  <Input id="salary" name="salary" type="number" value={staff.salary} onChange={handleInputChange} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">FULL NAME</div>
                  <div className="text-sm font-semibold text-gray-900">{staff.firstName} {staff.lastName}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">PHONE</div>
                  <div className="text-sm font-semibold text-gray-900">{staff.phoneNumber}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">ROLE</div>
                  <div className="text-sm font-semibold text-gray-900">{staff.role}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">SALARY</div>
                  <div className="text-sm font-semibold text-gray-900">KES {staff.salary}</div>
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
                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
