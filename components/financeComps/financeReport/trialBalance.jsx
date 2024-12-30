'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, X } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function TrialBalance({ data }) {
  const formatCurrency = (value) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  console.log(data);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[800px] sm:max-h-[700px]">
        <Card className="border-none shadow-none">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold">Trial Balance</CardTitle>
          </CardHeader>

          {(!data || !data.accounts) ? (
            <CardContent>
              <div className="text-center text-gray-500">No trial balance data available</div>
            </CardContent>
          ) : (
            <>
              <CardContent className="p-6">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-24">Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.accounts.map((account, index) => (
                        <TableRow key={index} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-right">
                            {account.debit > 0 ? formatCurrency(account.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {account.credit > 0 ? formatCurrency(account.credit) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Card className="mt-6 bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Debits:</span>
                        <span className="font-bold">{formatCurrency(data.totalDebits)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-semibold">Total Credits:</span>
                        <span className="font-bold">{formatCurrency(data.totalCredits)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {data.totalDebits !== data.totalCredits && (
                    <Card className="mt-4 bg-destructive/10 text-destructive">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <span className="font-semibold">Warning: Trial balance is not balanced</span>
                        </div>
                        <div className="mt-2">
                          Difference: {formatCurrency(Math.abs(data.totalDebits - data.totalCredits))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </ScrollArea>
              </CardContent>
            </>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  )
}
