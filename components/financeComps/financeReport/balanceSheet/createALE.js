"use client"

import React, { useEffect, useState } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter, 
  SheetClose, 
  SheetTrigger
} from "@/components/ui/sheet"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import useWsinfoStore from '@/stores/wsinfo'
import { v4 as uuidv4 } from 'uuid';
import { toast } from "@/components/ui/use-toast";

// Predefined categories for each type
const CATEGORIES = {
  asset: [
    'Cash and Bank Balances', 
    'Accounts Receivable', 
    'Inventory',
    'Prepaid Expenses',
    'Other Current Assets',
    'Property & Equipment',
    'Accumulated Depreciation'
  ],
  liability: [
    'Accounts Payable', 
    'Short-Term Loans',
    'Other Current Liabilities',
    'Long-Term Loans'
  ],
  equity: [
    'Owner\'s Capital', 
    'Retained Earnings'
  ]
}

export default function CreateALESheet({ 
  onSubmit 
}) {
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [storeNo, setStoreNo] = useState("")
  const store = useWsinfoStore((state) => state.wsinfo);

  useEffect(() => {
    if (store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store.storeNo]);

  const handleSubmit = async () => {
    try {
        const newEntry = {
          _id: `${storeNo}:${uuidv4()}`,
          type,
          category,
          amount: parseFloat(amount),
          description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          storeNo: `${storeNo}`
        }

        const result = await window.electronAPI.realmOperation('createBalanceSheetEntry', newEntry);
        if (result.success) {
          toast({
            title: "Success",
            description: `${type} created successfully!`,
          });
          setCategory('')
          setAmount('')
          setDescription('')
        } else {
          throw new Error(result.error);
        }
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        title: "Error",
        description: `Failed to create ${type}. Please try again.`,
        variant: "destructive",
      });
    }
  }

  return (
    <Sheet >
      <SheetTrigger asChild>
        <Button > Add New </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New Balance Sheet Entry</SheetTitle>
          <SheetDescription>
            Add a new Asset, Liability, or Equity entry
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-4 py-4">
          {/* Type Selection */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <Select 
              value={type} 
              onValueChange={setType}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Selection (Conditional) */}
          {type && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Select 
                value={category} 
                onValueChange={setCategory}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES[type].map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input 
              id="amount" 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3" 
              placeholder="Enter amount" 
            />
          </div>

          {/* Description Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input 
              id="description" 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3" 
              placeholder="Enter description (optional)" 
            />
          </div>
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              disabled={!type || !category || !amount}
            >
              Create Entry
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
