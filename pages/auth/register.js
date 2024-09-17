import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import { setStoreNo } from '@/electron/store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useWsinfoStore from '@/stores/wsinfo';
import { SubsPlan } from '@/components/subs-plan';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BadgeDollarSign, Check, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Register() {
  const router = useRouter();
  const [card, setCard] = useState(1)
  const [selectedSub, setSelectedSub] = useState(null);
  const [wholesalerData, setWholesalerData] = useState({
    name: '',
    phone: '',
    location: '',
    subscription: 0,
    plan: '',
  });
  const [staffData, setStaffData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'Admin',
    passcode: ''
  });
  const [storeNo, setStoreNo] = useState('');
  const addWsinfo = useWsinfoStore((state) => state.addWsinfo);

  const handleWholesalerChange = (e) => {
    setWholesalerData({ ...wholesalerData, [e.target.name]: e.target.value });
  };

  console.log(storeNo)

  const handleStaffChange = (e) => {
    setStaffData({ ...staffData, [e.target.name]: e.target.value });
  };

  const handlePlanSelect = (plan) => {
    setWholesalerData({ ...wholesalerData, plan });
    setIsDialogOpen(false);
  };

  const handleNext = () => {
    if(card < 3) {
      const nextPage = card + 1;
      setCard(nextPage)
    }
  }

  const handlePrevious = () => {
    if(card > 1) {
      const previousPage = card - 1;
      setCard(previousPage)
    }
  }

  const handleSubs = async (amount, type) => {
    setSelectedSub(type);
    setWholesalerData(prevData => ({
      ...prevData,
      subscription: amount,
      plan: type
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsDialogOpen(true);
  };

  const handleRegister = async () => {
    try {
      const wholesalerResult = await window.electronAPI.realmOperation('createWholeSaler', {
        ...wholesalerData,
        _id: uuidv4(),
        storeNo: storeNo,
        ends: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setStoreNo(storeNo);

      if (wholesalerResult.success) {
        const staffResult = await window.electronAPI.realmOperation('createStaff', {
          ...staffData,
          _id: uuidv4(),
          salary: 0,
          storeNo: storeNo,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        if (staffResult.success) {
          addWsinfo(wholesalerResult.wholeSaler);
          router.push('/');
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
    <div className='h-[100%]' >
      {
        card === 1 && (
          <Card className="w-full py-2 md:py-4 lg:py-4">
        <CardHeader className="mx-auto max-w-3xl space-y-4 text-center">
          <CardTitle className="text-3xl font-bold tracking-tighter sm:text-5xl">Subscription Plans</CardTitle>
          <CardDescription className="text-muted-foreground md:text-xl">
            Choose the perfect plan for your business and start accepting payments with our powerful POS app.
          </CardDescription>
        </CardHeader>
        <div className="mx-auto mt-2 max-w-4xl">
          <div className="grid gap-2 md:grid-cols-3">
            <Card className="space-y-4 rounded-lg bg-background p-6 shadow-md">
              <CardHeader className="space-y-2 p-0">
                <CardTitle className="text-2xl font-bold">Shop</CardTitle>
                <CardDescription className="text-muted-foreground">Perfect for small businesses</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">KES 1000</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <CardContent className="p-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>1 User</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>100 GB Storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Basic Reporting</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => handleSubs(1000, 'SHOP')} 
                  className={`w-full ${selectedSub === 'SHOP' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                >
                  {selectedSub === 'SHOP' ? 'Selected' : 'Subscribe'}
                </Button>
              </CardFooter>
            </Card>
            <Card className="space-y-4 rounded-lg bg-background p-6 shadow-md">
              <CardHeader className="space-y-2 p-0">
                <CardTitle className="text-2xl font-bold">Wholesaler</CardTitle>
                <CardDescription className="text-muted-foreground">For growing businesses</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">KES 2000</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <CardContent className="p-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>5 Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>500 GB Storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Advanced Reporting</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => handleSubs(2000, 'WHOLESALER')} 
                  className={`w-full ${selectedSub === 'WHOLESALER' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                >
                  {selectedSub === 'WHOLESALER' ? 'Selected' : 'Subscribe'}
                </Button>
              </CardFooter>
            </Card>
            <Card className="space-y-4 rounded-lg bg-background p-6 shadow-md">
              <CardHeader className="space-y-2 p-0">
                <CardTitle className="text-2xl font-bold">Supplier</CardTitle>
                <CardDescription className="text-muted-foreground">For large businesses</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">CUSTOM</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <CardContent className="p-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Unlimited Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>1 TB Storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Custom Reporting</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleNext} 
                  className={`w-full ${selectedSub === 'SUPPLIER' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                >
                  {selectedSub === 'SUPPLIER' ? 'Selected' : 'Interested'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      <CardFooter className="flex justify-end mt-6" >
        <Button onClick={handleNext} className="" >Next <ChevronRight /></Button>
      </CardFooter>
    </Card>
        )
      }

      {
      card === 2 && (
        <Card className="">
          <CardHeader >
            <CardTitle>Registration</CardTitle>
            <CardDescription>Fill the two forms below to register your business and admin account</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto p-6 sm:p-8 md:p-10" >
            <Card>
            <CardHeader>
              <CardTitle>Register Your Business</CardTitle>
              <CardDescription>Fill out the form below to register your business.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Wholesaler Name</Label>
                  <Input id="name" name="name" value={wholesalerData.name} onChange={handleWholesalerChange} required placeholder="Enter wholesaler name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Store No</Label>
                  <Input id="storeNo" name="storeNo" value={storeNo} onChange={(e) => {setStoreNo(e.target.value)}} required placeholder="Add wholesaler store No" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="number" name="phone" value={wholesalerData.phone} onChange={handleWholesalerChange} required placeholder="Enter phone number" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" value={wholesalerData.location} onChange={handleWholesalerChange} required placeholder="Enter location" />
                </div>
              </form>
            </CardContent>
            {/* <CardFooter>
              <Button className="ml-auto" onClick={handleSubmit}>Register Shop</Button>
            </CardFooter> */}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Register Admin Account</CardTitle>
              <CardDescription>Fill out the form below to register your admin account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" name="firstName" value={staffData.firstName} onChange={handleStaffChange} required placeholder="Enter first name" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" name="lastName" value={staffData.lastName} onChange={handleStaffChange} required placeholder="Enter last name" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staffPhone">Phone Number</Label>
                  <Input id="staffPhone" name="phone" value={staffData.phone} onChange={handleStaffChange} required placeholder="Enter staff phone number" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="passcode">Passcode</Label>
                  <Input id="passcode" name="passcode" type="password" value={staffData.passcode} onChange={handleStaffChange} required placeholder="Enter staff passcode" />
                </div>
              </form>
            </CardContent>
            {/* <CardFooter>
              <Button className="ml-auto" onClick={handlePrevious}>Register Admin</Button>
            </CardFooter> */}
          </Card>
          </CardContent>
          <CardFooter className="flex justify-between" >
            <Button onClick={handlePrevious}><ChevronLeft/> Previous</Button>
            <Button onClick={handleNext} >Next <ChevronRight /></Button>
          </CardFooter>
        </Card>
      )
    }

    {
      card === 3 && (
        <Card >
          <CardHeader >
            <CardTitle >Payment</CardTitle>
            <CardDescription >Confirm the details and proceed to pay</CardDescription>
          </CardHeader>
          <CardContent>
            <div>This is a test</div>
            <div>This is a test</div>
            <div>This is a test</div>
            <div>This is a test</div>
            <Button >PAY <BadgeDollarSign /></Button>
          </CardContent>
          <CardFooter className="flex justify-between" >
            <Button onClick={handlePrevious}><ChevronLeft/> Previous</Button>
            <Button onClick={handleRegister} >Register  <BadgeDollarSign /></Button>
          </CardFooter>
        </Card>
      )
    }
    </div>
  );
}
