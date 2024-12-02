"use client"

import React from 'react'
import EditCustomer from './editCustomer'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, CreditCard, DollarSign, Phone, MapPin, Activity, ShoppingCart, TrendingUp } from 'lucide-react'

export default function ViewCustomer({ customer = {
  name: "Jane Smith",
  phoneNumber: "+1 (555) 123-4567",
  address: "123 Main St, Anytown, USA 12345",
  credit: true,
  status: "Active",
  createdAt: "2023-01-15T00:00:00.000Z",
  balance: 5000,
  timesBought: 8,
  avgTransaction: 2000,
  totalTransactions: 86000,
  avatar: "https://i.pravatar.cc/300?img=47"
} }) {

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
    <div className="container mx-auto p-6 space-y-6">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={customer.avatar} alt={customer.name} />
            <AvatarFallback>{customer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl font-bold">{customer.name}</CardTitle>
              <Badge variant={customer.status === 'Active' ? "default" : "secondary"}>
                {customer.status}
              </Badge>
            </div>
            <CardDescription className="text-base mt-1">
              Customer since {new Date(customer.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Customer Info</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="history">Sales History</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoItem icon={Phone} label="Phone Number" value={customer.phoneNumber} />
                <InfoItem icon={MapPin} label="Address" value={customer.address} />
                <InfoItem icon={CreditCard} label="Credit" value={customer.credit ? "Approved" : "Not Approved"} />
                <InfoItem icon={CalendarDays} label="Join Date" value={new Date(customer.createdAt).toLocaleDateString()} />
              </div>
            </TabsContent>
            <TabsContent value="insights" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">Current Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">KSH {customer.balance.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">Key Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MetricItem icon={ShoppingCart} label="Times Bought" value={customer.timesBought} />
                    <MetricItem icon={DollarSign} label="Avg. Transaction" value={`KSH ${customer.avgTransaction}`} />
                    <MetricItem icon={TrendingUp} label="Total Transactions" value={`KSH ${customer.totalTransactions}`} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">Sales History</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Sales data will be added here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          {/* <Button >Edit Customer</Button> */}
          <EditCustomer customer={customer} />
        </CardFooter>
      </Card>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-base font-semibold">{value}</p>
      </div>
    </div>
  )
}

function MetricItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-base font-semibold">{value}</p>
    </div>
  )
}