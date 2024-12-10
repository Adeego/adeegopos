"use client"

import React, { useEffect, useState } from 'react'
import useWsinfoStore from '@/stores/wsinfo'
import { v4 as uuidv4 } from 'uuid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, ChevronDown, Search, X } from 'lucide-react'

export default function AddTransaction() {
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const [amount, setAmount] = useState(0);
  const [open, setOpen] = React.useState(false);
  const [accounts, setAccounts] = useState([]);
  const [description, setDescription] = useState("")
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState("account");
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [transType, setTransType] = useState("deposit");
  const [date, setDate] = useState(() => new Date());
  const [fromLabel, setFromLabel] = useState("");
  const [toLabel, setToLabel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [storeNo, setStoreNo] = useState("");
  const [alert, setAlert] = useState({ show: false, message: '', type: 'default' });

  useEffect(() => {
    fetchAccounts();
  }, []);
  
  useEffect(() => {
    const storeNo = wsinfo.storeNo;
    if (storeNo) {
      setStoreNo(storeNo)
    }
  }, [wsinfo.storeNo])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm && transType === "deposit") {
        performSearch(searchTerm, source);
      } else if (searchTerm && transType === "withdraw") {
        performSearch(searchTerm, destination);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  }

  const handleDescription = (e) => {
    setDescription(e.target.value);
  }

  const fetchAccounts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllAccounts');
      if (result.success) {
        setAccounts(result.accounts || []); // Ensure accounts is always an array
      } else {
        setAccounts([]); // Set empty array if request fails
        console.error('Failed to fetch accounts:', result.error);
      }
    } catch (error) {
      setAccounts([]); // Set empty array on error
      console.error('Error fetching accounts:', error);
    }
  };

  const performSearch = async (searchTerm, type ) => {
    if (!searchTerm) return;
    try {
      const searchResult = await window.electronAPI.searchCSS(searchTerm, type.toLowerCase());
      if (searchResult.success) {
        setSearchResult(searchResult.result);
      }
    } catch (error) {
      console.error('Error during search:', error);
    }
  };

  const handleAccountAlocation = (value) => {
    if (value === "deposit") {
      setTransType("deposit");
      setDestination("account");
      setSource(null);
      setFrom(null);
      setFromLabel("");
      setDescription("");
      setAmount(0);
      setDate(() => new Date());
    } else if (value === "withdraw") {
      setTransType("withdraw"); 
      setSource("account");
      setDestination(null);
      setTo(null);
      setToLabel("");
      setDescription("");
      setAmount(0);
      setDate(() => new Date());
    }
  };

  const handleSubmit = (action) => async (e) => {
    e.preventDefault()
    // Here you would typically handle the deposit or withdrawal
    try {
      const transData = {
        "_id": `${storeNo}:${uuidv4()}`,
        "description": description,
        "transType": transType,
        "source": source,
        "destination": destination,
        "from": from,
        "to": to,
        "amount": parseInt(amount),
        "date": date.toISOString()
      }
      console.log(action)
      console.log(transData)

      const result = await window.electronAPI.realmOperation('createTransaction', transData);
      if (result.success) {
        // toast({
        //   title: "Success",
        //   description: "Transaction recorded successfully!",
        // });
        if (typeof fetchTransactions === 'function') {
          fetchTransactions();
        }
        
        // Clear all field states
        setAmount(0);
        setDescription("");
        setSource(null);
        setDestination("account");
        setFrom(null);
        setTo(null);
        setDate(() => new Date());
        setFromLabel("");
        setToLabel("");
        setSearchTerm("");
        setSearchResult([]);
        
      } else {
        throw new Error(result.error || 'Failed to create transaction');
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
      setAlert({
        show: true,
        message: "Failed to record transaction. Please try again.",
        type: 'error'
      });
    }
  }

  return (
    <div className="">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">Add Transaction</Button>
        </SheetTrigger>
        <SheetContent>
          <ScrollArea className="h-full pr-4 [&_[data-radix-scroll-area-scrollbar]]:hidden">
            <SheetHeader>
              <SheetTitle>Transaction Recording</SheetTitle>
              <SheetDescription>Manage your account balance</SheetDescription>
            </SheetHeader>
            {alert.show && (
              <Alert variant={alert.type}>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            )}
            <div className="mt-6">
              <Tabs defaultValue="deposit" onValueChange={(value) => {handleAccountAlocation(value)}} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="deposit">Deposit</TabsTrigger>
                  <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                </TabsList>

                <TabsContent value="deposit">
                  <form onSubmit={handleSubmit("deposit")}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          placeholder="Fill the transaction description"
                          type="text"
                          value={description}
                          onChange={handleDescription}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <Select onValueChange={(value) => {
                          setSource(value);
                          setFrom(null);
                          setFromLabel(null)
                          }}>
                          <SelectTrigger className="w-[100%]">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="account">Account</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="supplier">Supplier</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {
                        source && source === "account" && (
                          <div className="space-y-2">
                            <Label htmlFor="from">From</Label>
                            <Select onValueChange={(value) => setFrom(value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem key={account._id} value={account._id}>
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      }
                      {
                        source && source !== "account" && (
                          <div className="space-y-2">
                            <Label htmlFor="From">From Rest</Label>
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline" 
                                  role="combobox" 
                                  aria-expanded={dialogOpen}
                                  className="w-full justify-between"
                                  id="destination-select"
                                >
                                  {fromLabel || `Select ${source}`}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Select {source}</DialogTitle>
                                  <DialogDescription>Search and select a specific {source}</DialogDescription>
                                </DialogHeader>
                                <div className='space-y-4'>
                                  <div className="sticky top-0 bg-background px-3 pb-3 pt-2">
                                    <Input
                                      placeholder={`Search ${source}`}
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.target.value)}
                                      className="w-full"
                                      autoComplete="off"
                                      onFocus={(e) => e.target.select()}
                                      autoFocus
                                    />
                                  </div>
                                  <ScrollArea className="h-[200px]">
                                    {searchResult.length > 0 ? (
                                      <div className="space-y-1 px-1">
                                        {searchResult.map((item) => (
                                          <Button
                                            key={item._id}
                                            variant="ghost"
                                            className="w-full justify-start font-normal"
                                            onClick={() => {
                                              setFromLabel(item.name)
                                              setFrom(item._id)
                                              setSearchTerm("")
                                              setSearchResult([])
                                              setDialogOpen(false)
                                            }}
                                          >
                                            {item.name}
                                          </Button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center h-full">
                                        <p className="text-sm text-muted-foreground">No results found</p>
                                      </div>
                                    )}
                                  </ScrollArea>
                                </div>
                                  
                              </DialogContent>
                            </Dialog>
                          </div>
                        )
                      }

                      <div className="space-y-2">
                        <Label htmlFor="destination">Destination</Label>
                        <Input
                          id="destination" 
                          type="text"
                          value={destination}
                          readOnly
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="to">To</Label>
                        <Select onValueChange={(value) => setTo(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account._id} value={account._id}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="deposit-amount">Amount</Label>
                        <Input
                          id="deposit-amount"
                          placeholder="Enter amount"
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="date-picker">Transaction Date</Label>
                        <Dialog open={dateOpen} onOpenChange={setDateOpen} className="" >
                          <DialogTrigger className='' asChild>
                            <Button
                              id="date-picker"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-auto">
                            <DialogHeader className="px-4 pt-4">
                              <DialogTitle>Calendar</DialogTitle>
                              <DialogDescription>Select the date of the transaction</DialogDescription>
                            </DialogHeader>
                            <Calendar
                              mode="single"
                              selected={date}
                              onSelect={(newDate) => {
                                setDate(newDate);
                                setDateOpen(false);
                              }}
                              initialFocus
                              className="p-4"
                            />
                          </DialogContent>
                        </Dialog>
                      </div>

                      <Button type="submit" className="w-full">Deposit</Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="withdraw">
                  <form onSubmit={handleSubmit("withdraw")}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          placeholder="Fill the transaction description"
                          type="text"
                          value={description}
                          onChange={handleDescription}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <Input
                          id="source" 
                          type="text"
                          value={source}
                          readOnly
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="from">From</Label>
                        <Select onValueChange={(value) => setFrom(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account._id} value={account._id}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="destination">Destination</Label>
                        <Select onValueChange={(value) => {
                          setDestination(value);
                          setTo(null);
                          setToLabel(null)
                          }}>
                          <SelectTrigger className="w-[100%]">
                            <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="account">Account</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="supplier">Supplier</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {
                        destination && destination === "account" && (
                          <div className="space-y-2">
                            <Label htmlFor="to">To</Label>
                            <Select onValueChange={(value) => setTo(value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem key={account._id} value={account._id}>
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      }
                      {
                        destination && destination !== "account" && (
                          <div className="space-y-2">
                            <Label htmlFor="destination-select">To</Label>
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  role="combobox" 
                                  aria-expanded={dialogOpen}
                                  className="w-full justify-between"
                                  id="destination-select"
                                >
                                  {toLabel || `Select ${destination}`}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Select {destination}</DialogTitle>
                                  <DialogDescription>Search and select a specific {destination}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="sticky top-0 bg-background px-3 pb-3 pt-2">
                                    <Input
                                      placeholder={`Search ${destination}`}
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.target.value)}
                                      className="w-full"
                                      autoComplete="off"
                                      onFocus={(e) => e.target.select()}
                                      autoFocus
                                    />
                                  </div>
                                  <ScrollArea className="h-[200px] [&_[data-radix-scroll-area-scrollbar]]:hidden">
                                    {searchResult.length > 0 ? (
                                      <div className="space-y-1 px-1">
                                        {searchResult.map((item) => (
                                          <Button
                                            key={item._id}
                                            variant="ghost"
                                            className="w-full justify-start font-normal"
                                            onClick={() => {
                                              setToLabel(item.name)
                                              setTo(item._id)
                                              setSearchTerm("")
                                              setSearchResult([])
                                              setDialogOpen(false)
                                            }}
                                          >
                                            {item.name}
                                          </Button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex h-full items-center justify-center p-4">
                                        <p className="text-sm text-muted-foreground">No results found</p>
                                      </div>
                                    )}
                                  </ScrollArea>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )
                      }

                      <div className="space-y-2">
                        <Label htmlFor="deposit-amount">Amount</Label>
                        <Input
                          id="deposit-amount"
                          placeholder="Enter amount"
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="date-picker">Transaction Date</Label>
                        <Dialog open={dateOpen} onOpenChange={setDateOpen} className="" >
                          <DialogTrigger className='' asChild>
                            <Button
                              id="date-picker"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-auto">
                            <DialogHeader className="px-4 pt-4">
                              <DialogTitle>Calendar</DialogTitle>
                              <DialogDescription>Select the date of the transaction</DialogDescription>
                            </DialogHeader>
                            <Calendar
                              mode="single"
                              selected={date}
                              onSelect={(newDate) => {
                                setDate(newDate);
                                setDateOpen(false);
                              }}
                              initialFocus
                              className="p-4"
                            />
                          </DialogContent>
                        </Dialog>
                      </div>

                      <Button type="submit" className="w-full">Deposit</Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
            <div className="mt-6 text-sm text-muted-foreground">
              Please ensure you have sufficient funds for withdrawals.
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}