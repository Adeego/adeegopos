import React, { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from '@/components/ui/input'
import { ArrowRight, FileText } from 'lucide-react'

export default function filteredStatements({ statements }) {
    const [isOpen, onOpenChange] = useState(false)

    // Calculate summary
    const summary = statements?.reduce((acc, { amount, transType }) => {
          if (transType === "deposit") {
            acc.totalDeposits += amount;
          } else {
            acc.totalWithdrawals += amount;
          }
          acc.balance = acc.totalDeposits - acc.totalWithdrawals;
          return acc;
        }, {
          totalDeposits: 0,
          totalWithdrawals: 0,
          balance: 0
    }) || {
      totalDeposits: 0,
      totalWithdrawals: 0,
      balance: 0
    };

    // Helper function to format date
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const formatCurrency = (amount) => {
      return amount.toLocaleString('en-US', { 
        style: 'currency', 
        currency: 'KES',
        minimumFractionDigits: 2
      })
    }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger >
        <Button variant="outline" ><ArrowRight /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Statement of Account</DialogTitle>
          <DialogDescription>
            This shows a detailed statement of account for the selected period
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Deposits</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalDeposits)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Withdrawals</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalWithdrawals)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Current Balance</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="relative max-h-[400px] overflow-auto border rounded-lg">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Deposits</TableHead>
                  <TableHead className="text-right">Withdrawals</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  statements && statements.map(function(statement, index) {
                    var runningBalance = statements
                      .slice(0, index + 1)
                      .reduce(function(acc, curr) {
                        return acc + (curr.transType === "deposit" ? curr.amount : -curr.amount);
                      }, 0);

                    return (
                      <TableRow key={index}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(statement.date)}
                        </TableCell>
                        <TableCell>{statement.description}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {statement.transType === "deposit" && formatCurrency(statement.amount)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {statement.transType === "withdraw" && formatCurrency(statement.amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(runningBalance)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
