import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';
import { Edit3, Save, X, Trash2, User, Phone, Briefcase, DollarSign } from 'lucide-react'

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
        const result = await window.electronAPI.realmOperation('archiveStaff', id);
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
    <div className="max-w-2xl mx-auto p-4">
      <Card className="w-full bg-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Staff Details</CardTitle>
          <CardDescription>
            Joined on {new Date(staff.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={staff.firstName} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={staff.lastName} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phoneNumber" value={staff.phoneNumber} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={staff.role} onValueChange={handleRoleChange}>
                  <SelectTrigger>
                    <SelectValue>{staff.role}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Worker">Worker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary">Salary</Label>
                <Input id="salary" name="salary" type="number" value={staff.salary} onChange={handleInputChange} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <User className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-medium">Full Name</p>
                  <p className="text-lg font-semibold">{staff.firstName} {staff.lastName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <Phone className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-lg font-semibold">{staff.phoneNumber}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <Briefcase className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-lg font-semibold">{staff.role}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <DollarSign className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-medium">Salary</p>
                  <p className="text-lg font-semibold">KES {staff.salary.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit3 className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
