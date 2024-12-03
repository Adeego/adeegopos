import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, CreditCard, DollarSign, Phone, MapPin, Activity, ShoppingCart, TrendingUp, PrinterIcon, CreditCardIcon, CalendarIcon, EyeIcon, ShoppingCartIcon } from 'lucide-react'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import useStaffStore from '@/stores/staffStore'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function CustomerDetail() {
  const [customer, setCustomer] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState(null);
  const [role, setRole] = useState(null);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null)
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [toDate, setToDate] = useState(new Date());
  const staff = useStaffStore((state) => state.staff)
  const router = useRouter()
  const {id} = router.query

  useEffect(() => {
    if (id) {
      fetchSelectedCustomer();
      fetchCustomerSales();
    }
  }, [id]);

  useEffect(() => {
    if (customer) {
      setEditedCustomer({ ...customer });
    }
  }, [customer]);

  useEffect(() => {
    if (staff.role) {
      setRole(staff.role);
    }
  }, [staff.role])

  const fetchSelectedCustomer = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getCustomerById', id);
      if (result.success) {
        setCustomer(result.customer);
      } else {
        console.error('Failed to fetch customer:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedCustomer(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        setCustomer(customerData);
        setIsEditing(false);
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
    }
  };

  const fetchCustomerSales = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getCustomerSales', id, fromDate, toDate);
      if (result.success) {
        setSales(result.sales)
        console.log(result.sales);
      } else {
        console.error('Failed to fetch sales:', result.error);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading customer data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Customer Details</h1>
      {isEditing ? (
        <div className="container mx-auto p-6 space-y-6">
          <Card className="w-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={editedCustomer.avatar} alt={editedCustomer.name} />
                <AvatarFallback>{editedCustomer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Input
                    name="name"
                    value={editedCustomer.name}
                    onChange={handleInputChange}
                    className="text-3xl font-bold"
                  />
                  <Select
                    name="status"
                    value={editedCustomer.status}
                    onValueChange={(value) => setEditedCustomer(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Neutral">Neutral</SelectItem>
                      <SelectItem value="Bad">Bad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      value={editedCustomer.phoneNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      value={editedCustomer.address}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balance">Balance</Label>
                    <Input
                      id="balance"
                      name="balance"
                      type="number"
                      value={editedCustomer.balance}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="credit">Credit Approved</Label>
                    <Checkbox
                      id="credit"
                      name="credit"
                      checked={editedCustomer.credit}
                      onCheckedChange={(checked) => setEditedCustomer(prev => ({ ...prev, credit: checked }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button type="submit">Save Changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
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

                  {
                    role && (role === 'Admin' || role === 'Operator') && 
                    <CardFooter className="flex justify-end">
                      <Button onClick={() => setIsEditing(true)}>Edit Customer</Button>
                    </CardFooter>
                  }
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
                    {/* <Card>
                      <CardHeader>
                        <CardTitle className="text-xl font-semibold">Key Metrics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <MetricItem icon={ShoppingCart} label="Times Bought" value={customer.timesBought} />
                        <MetricItem icon={DollarSign} label="Avg. Transaction" value={`KSH ${customer.avgTransaction}`} />
                        <MetricItem icon={TrendingUp} label="Total Transactions" value={`KSH ${customer.totalTransactions}`} />
                      </CardContent>
                    </Card> */}
                  </div>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Sales Overview</CardTitle>
                        <CardDescription>A detailed list of all sales transactions</CardDescription>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !fromDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {fromDate ? format(fromDate, "PPP") : <span>From Date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={fromDate}
                              onSelect={setFromDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !toDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {toDate ? format(toDate, "PPP") : <span>To Date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={toDate}
                              onSelect={setToDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Button onClick={fetchCustomerSales} >Retreive</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {sales.length > 0 ? (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Payment Method</TableHead>
                                <TableHead>Sale Type</TableHead>
                                <TableHead className="text-right">Items</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sales.map((sale) => (
                                <TableRow key={sale._id}>
                                  <TableCell className="font-medium">
                                    {new Date(sale.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </TableCell>
                                  <TableCell>KSH {sale.totalAmount.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                      <CreditCardIcon className="h-3 w-3" />
                                      {sale.paymentMethod}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="flex items-center gap-1">
                                      <ShoppingCartIcon className="h-3 w-3" />
                                      {sale.saleType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{sale.totalItems}</TableCell>
                                  <TableCell className="text-right">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="flex items-center gap-1"
                                          onClick={() => setSelectedSale(sale)}
                                        >
                                          <EyeIcon className="h-3 w-3" />
                                          View
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-[600px]">
                                        <DialogHeader>
                                          <DialogTitle>Sale Details</DialogTitle>
                                          <DialogDescription>
                                            Detailed information about the selected sale
                                          </DialogDescription>
                                        </DialogHeader>
                                        <ScrollArea className="h-[400px] w-full pr-4">
                                          {selectedSale && (
                                            <div className="space-y-4">
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                  <p className="text-sm font-medium text-muted-foreground">Sale Date</p>
                                                  <p className="flex items-center gap-1">
                                                    <CalendarIcon className="h-4 w-4" />
                                                    {new Date(selectedSale.createdAt).toLocaleString()}
                                                  </p>
                                                </div>
                                                <div className="space-y-1">
                                                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                                                  <p className="flex items-center gap-1">
                                                    <CreditCardIcon className="h-4 w-4" />
                                                    {selectedSale.paymentMethod}
                                                  </p>
                                                </div>
                                                <div className="space-y-1">
                                                  <p className="text-sm font-medium text-muted-foreground">Sale Type</p>
                                                  <p className="flex items-center gap-1">
                                                    <ShoppingCartIcon className="h-4 w-4" />
                                                    {selectedSale.saleType}
                                                  </p>
                                                </div>
                                                <div className="space-y-1">
                                                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                                                  <p className="font-semibold">KSH {selectedSale.totalAmount.toLocaleString()}</p>
                                                </div>
                                              </div>
                
                                              <div className="mt-6">
                                                <h3 className="text-lg font-semibold mb-2">Items</h3>
                                                <div className="rounded-md border">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>Product</TableHead>
                                                        <TableHead className="text-right">Quantity</TableHead>
                                                        <TableHead className="text-right">Unit Price</TableHead>
                                                        <TableHead className="text-right">Subtotal</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {selectedSale.items.map((item) => (
                                                        <TableRow key={item._id}>
                                                          <TableCell>{item.name}</TableCell>
                                                          <TableCell className="text-right">{item.quantity}</TableCell>
                                                          <TableCell className="text-right">KSH {item.unitPrice.toLocaleString()}</TableCell>
                                                          <TableCell className="text-right">KSH {item.subtotal.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </ScrollArea>
                                        <DialogFooter>
                                          <Button className="flex items-center gap-1">
                                            <PrinterIcon className="h-4 w-4" />
                                            Print
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No sales found for the selected date range.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
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
