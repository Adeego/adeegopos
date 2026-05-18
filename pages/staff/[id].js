import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/components/ui/use-toast';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { Edit3, Save, X, Trash2, User, Phone, Briefcase, DollarSign } from 'lucide-react'
import { can, getPrimaryRole, getRoleLabel, getRoleLabels, normalizeRoles, ROLE_OPTIONS } from '@/lib/rbac';

export default function StaffDetail() {
  const router = useRouter();
  const { id } = router.query;
  const {toast} = useToast();
  const [staff, setStaff] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const store = useWsinfoStore((state) => state.wsinfo);
  const currentStaff = useStaffStore((state) => state.staff);
  const [storeNo, setStoreNo] = useState('');
  const canManageStaff = can(currentStaff, 'staff:manageRoles');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (id && storeNo) {
      fetchStaffDetail();
    }
  }, [id, storeNo]);

  const fetchStaffDetail = async () => {
    if (!storeNo) return;
    try {
      const result = await window.electronAPI.realmOperation('getStaffById', id, storeNo);
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

  const handleRoleToggle = (role, checked) => {
    const currentRoles = normalizeRoles(staff.roles || staff.role);
    const roles = checked
      ? normalizeRoles([...currentRoles, role])
      : normalizeRoles(currentRoles.filter((item) => item !== role));
    setStaff({ ...staff, roles, role: getRoleLabel(getPrimaryRole(roles)) });
  };

  const handleSave = async () => {
    if (!storeNo) return;
    try {
      const roles = normalizeRoles(staff.roles || staff.role);
      const result = await window.electronAPI.realmOperation('updateStaff', {
        ...staff,
        roles,
        role: getRoleLabel(getPrimaryRole(roles)),
        salary: parseFloat(staff.salary),
        updatedAt: new Date().toISOString(),
        storeNo
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
    if (!storeNo) return;
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        const result = await window.electronAPI.realmOperation('archiveStaff', { id, storeNo });
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
                <Input id="phone" name="phone" value={staff.phone || staff.phoneNumber || ''} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                  {ROLE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={normalizeRoles(staff.roles || staff.role).includes(option.value)}
                        onCheckedChange={(checked) => handleRoleToggle(option.value, checked === true)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
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
                  <p className="text-lg font-semibold">{staff.phone || staff.phoneNumber}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <Briefcase className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-lg font-semibold">{getRoleLabels(staff).join(', ') || staff.role}</p>
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
              {canManageStaff && (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit3 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
