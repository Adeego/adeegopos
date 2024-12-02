"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, Download } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area";

export default function IncomeStatement({statementData}) {
  // If no data is provided, use default empty structure
  const data = statementData || {
    sales: { cashSales: 0, mpesaSales: 0, creditSales: 0, totalSales: 0 },
    cogs: 0,
    expenses: {
      "rent&utilities": 0,
      "Salaries": 0,
      "transport&fuel": 0,
      "maintenance&repairs": 0,
      "otherExpenses": 0,
      totalExpenses: 0
    }
  };

  // Calculate derived financial metrics
  const totalSales = data.sales.totalSales;
  const grossProfit = totalSales - data.cogs;
  const netIncome = grossProfit - data.expenses.totalExpenses;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowRight className="text-" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Income Statement</DialogTitle>
          <DialogDescription>Financial overview for the selected period</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow">
          <div className="grid gap-4 pr-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {totalSales.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {grossProfit.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{((grossProfit / totalSales) * 100).toFixed(1)}% of Revenue</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Income</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {netIncome.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{((netIncome / totalSales) * 100).toFixed(1)}% of Revenue</p>
                </CardContent>
              </Card>
            </div>
            <Table className="max-h-[400px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Item</TableHead>
                  <TableHead className="text-right">Amount (KES)</TableHead>
                  <TableHead className="text-right">% of Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Revenue</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Cash Sales</TableCell>
                  <TableCell className="text-right">{data.sales.cashSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.sales.cashSales / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Mpesa Sales</TableCell>
                  <TableCell className="text-right">{data.sales.mpesaSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.sales.mpesaSales / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Credit Sales</TableCell>
                  <TableCell className="text-right">{data.sales.creditSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.sales.creditSales / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Total Revenue</TableCell>
                  <TableCell className="text-right">{totalSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
                <TableRow >
                    <TableCell />
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Cost of Goods Sold (COGS)</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="font-medium">Cost of Goods Sold</TableCell>
                  <TableCell className="text-right">{data.cogs.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.cogs / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow >
                    <TableCell />
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Gross Profit</TableCell>
                  <TableCell className="text-right">{grossProfit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((grossProfit / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow >
                    <TableCell />
                </TableRow>

                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Operating Expenses</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Rent and Utilities</TableCell>
                  <TableCell className="text-right">{data.expenses["rent&utilities"].toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.expenses["rent&utilities"] / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Salaries and Wages</TableCell>
                  <TableCell className="text-right">{data.expenses["Salaries"].toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.expenses["Salaries"] / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Transport and Fuel</TableCell>
                  <TableCell className="text-right">{data.expenses["transport&fuel"].toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.expenses["transport&fuel"] / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Maintenance and Repairs</TableCell>
                  <TableCell className="text-right">{data.expenses["maintenance&repairs"].toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.expenses["maintenance&repairs"] / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="">
                  <TableCell className="">- Other Expenses</TableCell>
                  <TableCell className="text-right">{data.expenses["otherExpenses"].toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.expenses["otherExpenses"] / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Total Operating Expenses</TableCell>
                  <TableCell className="text-right">{data.expenses.totalExpenses.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.expenses.totalExpenses / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow >
                    <TableCell />
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Net Income</TableCell>
                  <TableCell className="text-right">{netIncome.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((netIncome / totalSales) * 100).toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
        <DialogFooter>
            <Button variant="outline" size="sm" >
                <Download className="mr-2 h-4 w-4" />
                Export
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
