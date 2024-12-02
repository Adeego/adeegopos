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
import Link from "next/link";

export default function BalanceSheet({balanceSheetData}) {
  // If no data is provided, use default empty structure
  const data = balanceSheetData || {
    assets: {
      cashAndBankBalances: 0,
      accountsReceivable: 0,
      inventory: 0,
      prepaidExpenses: 0,
      otherCurrentAssets: 0,
      totalCurrentAssets: 0,
      fixedAssets: 0,
      totalAssets: 0
    },
    liabilities: {
      accountsPayable: 0,
      shortTermLoans: 0,
      otherCurrentLiabilities: 0,
      totalCurrentLiabilities: 0,
      longTermLoans: 0,
      totalLiabilities: 0
    },
    equity: {
      ownerCapital: 0,
      retainedEarnings: 0,
      totalEquity: 0
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowRight className="text-" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Balance Sheet</DialogTitle>
          <DialogDescription>Financial position overview</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow">
          <div className="grid gap-4 pr-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {data.assets.totalAssets.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Company Assets</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {data.liabilities.totalLiabilities.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Company Debts</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {data.equity.totalEquity.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Owner's Investment</p>
                </CardContent>
              </Card>
            </div>
            <Table className="max-h-[400px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Item</TableHead>
                  <TableHead className="text-right">Amount (KES)</TableHead>
                  <TableHead className="text-right">% of Total Assets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Assets</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Current Assets</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Cash and Bank Balances</TableCell>
                  <TableCell className="text-right">{data.assets.cashAndBankBalances.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.cashAndBankBalances / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Accounts Receivable</TableCell>
                  <TableCell className="text-right">{data.assets.accountsReceivable.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.accountsReceivable / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Inventory</TableCell>
                  <TableCell className="text-right">{data.assets.inventory.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.inventory / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Prepaid Expenses</TableCell>
                  <TableCell className="text-right">{data.assets.prepaidExpenses.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.prepaidExpenses / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Other Current Assets</TableCell>
                  <TableCell className="text-right">{data.assets.otherCurrentAssets.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.otherCurrentAssets / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Total Current Assets</TableCell>
                  <TableCell className="text-right">{data.assets.totalCurrentAssets.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.totalCurrentAssets / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Non-Current Assets</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Property & Equipment</TableCell>
                  <TableCell className="text-right">{data.assets.fixedAssets.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.fixedAssets / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Accumulated Depreciation</TableCell>
                  <TableCell className="text-right">{data.assets.fixedAssets.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.fixedAssets / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Total Non-Current Assets</TableCell>
                  <TableCell className="text-right">{data.assets.totalCurrentAssets.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.assets.totalCurrentAssets / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Total Assets</TableCell>
                  <TableCell className="text-right">{data.assets.totalAssets.toLocaleString()}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell />
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Liabilities</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Current Liabilities</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Accounts Payable</TableCell>
                  <TableCell className="text-right">{data.liabilities.accountsPayable.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.liabilities.accountsPayable / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Short-Term Loans</TableCell>
                  <TableCell className="text-right">{data.liabilities.shortTermLoans.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.liabilities.shortTermLoans / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>- Other Current Liabilities</TableCell>
                  <TableCell className="text-right">{data.liabilities.otherCurrentLiabilities.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.liabilities.otherCurrentLiabilities / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Total Current Liabilities</TableCell>
                  <TableCell className="text-right">{data.liabilities.totalCurrentLiabilities.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.liabilities.totalCurrentLiabilities / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Long-Term Loans</TableCell>
                  <TableCell className="text-right">{data.liabilities.longTermLoans.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.liabilities.longTermLoans / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Total Liabilities</TableCell>
                  <TableCell className="text-right">{data.liabilities.totalLiabilities.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.liabilities.totalLiabilities / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell />
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell className="font-medium">Equity</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Owner's Capital</TableCell>
                  <TableCell className="text-right">{data.equity.ownerCapital.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.equity.ownerCapital / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Retained Earnings</TableCell>
                  <TableCell className="text-right">{data.equity.retainedEarnings.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.equity.retainedEarnings / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted font-medium">
                  <TableCell>Total Equity</TableCell>
                  <TableCell className="text-right">{data.equity.totalEquity.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{((data.equity.totalEquity / data.assets.totalAssets) * 100).toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
        <DialogFooter>
            <Button  size="sm" >
                <Link href={'/finance/balanceSheet'} >Manage</Link>
            </Button>
            <Button variant="outline" size="sm" >
                <Download className="mr-2 h-4 w-4" />
                Export
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
