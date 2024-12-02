import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import AccountsTable from '@/components/financeComps/account/accountsTable'
import ExpenseTable from '@/components/financeComps/expense/expenseTable'
import TransactionTable from '@/components/financeComps/transaction/transactionTable'
import ReportDash from '@/components/financeComps/financeReport/reportDash'

export default function Finance() {
  return (
    <Tabs defaultValue="accounts" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
        <TabsTrigger value="accounts">ACCOUNTS</TabsTrigger>
        <TabsTrigger value="transaction">TRANSACTION</TabsTrigger>
        <TabsTrigger value="expense">EXPENSE</TabsTrigger>
        <TabsTrigger value="journal">JOURNAL</TabsTrigger>
        <TabsTrigger value="report">REPORT</TabsTrigger>
      </TabsList>
      <TabsContent value="accounts">
        <AccountsTable />
      </TabsContent>
      <TabsContent value="expense">
        <ExpenseTable />
      </TabsContent>
      <TabsContent value="transaction">
        <TransactionTable />
      </TabsContent>
      <TabsContent value="journal">
        <Card>
          <CardHeader>
            <CardTitle>Journal</CardTitle>
            <CardDescription>Access your accounting journal entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Journal entries content goes here.</p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="report">
        <ReportDash/>
      </TabsContent>
    </Tabs>
  )
}
