"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarIcon } from "@radix-ui/react-icons"
import { addDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export default function ProductSales({saleItems}) {
    const [date, setDate] = useState({
        from: new Date(),
        to: addDays(new Date(), 20),
    });

    function formatDate(date) {
      return date.toDateString(); // You can use other methods like toLocaleString() if needed
    }

    console.log(saleItems);

  return (
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-2xl font-bold text-gray-800">Product Sales</CardTitle>
          <CardDescription className="text-sm text-gray-600">Product sales over time</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className="w-[300px] justify-start text-base font-medium text-left border-gray-300 hover:bg-gray-100"
                >
                  <CalendarIcon className="mr-2 h-5 w-5 text-gray-500" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span className="text-gray-500">Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                  className="rounded-md border border-gray-200"
                />
              </PopoverContent>
            </Popover>
          </div>
    
          <ScrollArea className="h-[500px] rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Date</TableHead>
                  <TableHead className="font-semibold text-gray-700">UoM</TableHead>
                  <TableHead className="font-semibold text-gray-700">Unit Price</TableHead>
                  <TableHead className="font-semibold text-gray-700">Quantity</TableHead>
                  <TableHead className="font-semibold text-gray-700">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleItems.map((saleItem) => (
                  <TableRow key={saleItem._id} className="hover:bg-gray-50">
                    <TableCell>{formatDate(saleItem.createdAt)}</TableCell>
                    <TableCell>{saleItem.productVariantName}</TableCell>
                    <TableCell>{saleItem.unitPrice}</TableCell>
                    <TableCell>{saleItem.quantity}</TableCell>
                    <TableCell>{saleItem.subtotal}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    )
}
