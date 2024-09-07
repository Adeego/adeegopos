import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useWsinfoStore from '@/stores/wsinfo';

export default function Register() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [wholesalerData, setWholesalerData] = useState({
    name: '',
    phone: '',
    location: '',
    subscription: '',
    plan: '',
    Manager: ''
  });
  const [staffData, setStaffData] = useState({
    name: '',
    phone: '',
    role: 'admin',
    passcode: ''
  });
  const addWsinfo = useWsinfoStore((state) => state.addWsinfo);

  const handleWholesalerChange = (e) => {
    setWholesalerData({ ...wholesalerData, [e.target.name]: e.target.value });
  };

  const handleStaffChange = (e) => {
    setStaffData({ ...staffData, [e.target.name]: e.target.value });
  };

  const handlePlanSelect = (plan) => {
    setWholesalerData({ ...wholesalerData, plan });
    setIsDialogOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsDialogOpen(true);
  };

  const handleRegister = async () => {
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date().toISOString();
      const wholesalerResult = await window.electronAPI.realmOperation('createWholeSaler', {
        ...wholesalerData,
        _id: new Date().toISOString(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      if (wholesalerResult.success) {
        const staffResult = await window.electronAPI.realmOperation('createStaff', {
          ...staffData,
          _id: new Date().toISOString(),
          salary: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        if (staffResult.success) {
          addWsinfo(wholesalerResult.wholeSaler);
          router.push('/dashboard');
        } else {
          console.error('Failed to create staff:', staffResult.error);
        }
      } else {
        console.error('Failed to create wholesaler:', wholesalerResult.error);
      }
    } catch (error) {
      console.error('Error during registration:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Wholesaler Name</Label>
          <Input id="name" name="name" value={wholesalerData.name} onChange={handleWholesalerChange} required />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" value={wholesalerData.phone} onChange={handleWholesalerChange} required />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" value={wholesalerData.location} onChange={handleWholesalerChange} required />
        </div>
        <div>
          <Label htmlFor="Manager">Manager Name</Label>
          <Input id="Manager" name="Manager" value={wholesalerData.Manager} onChange={handleWholesalerChange} required />
        </div>
        <div>
          <Label htmlFor="staffName">Staff Name</Label>
          <Input id="staffName" name="name" value={staffData.name} onChange={handleStaffChange} required />
        </div>
        <div>
          <Label htmlFor="staffPhone">Staff Phone</Label>
          <Input id="staffPhone" name="phone" value={staffData.phone} onChange={handleStaffChange} required />
        </div>
        <div>
          <Label htmlFor="passcode">Staff Passcode</Label>
          <Input id="passcode" name="passcode" type="password" value={staffData.passcode} onChange={handleStaffChange} required />
        </div>
        <Button type="submit">Register</Button>
      </form>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a Subscription Plan</DialogTitle>
            <DialogDescription>
              Select a plan that best suits your business needs.
            </DialogDescription>
          </DialogHeader>
          <Select onValueChange={handlePlanSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic Plan</SelectItem>
              <SelectItem value="pro">Pro Plan</SelectItem>
              <SelectItem value="enterprise">Enterprise Plan</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleRegister}>Complete Registration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
