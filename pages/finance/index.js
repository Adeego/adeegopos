import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import AccountsTable from '@/components/financeComps/account/accountsTable'
import ExpenseTable from '@/components/financeComps/expense/expenseTable'
import TransactionTable from '@/components/financeComps/transaction/transactionTable'
import ReportDash from '@/components/financeComps/financeReport/reportDash'

export default function Finance() {
  const router = useRouter()
  const queryView = Array.isArray(router.query.view) ? router.query.view[0] : router.query.view
  const aliases = {
    account: 'accounts',
    transaction: 'transactions',
    expense: 'expenses',
    report: 'reports',
  }
  const activeView = aliases[queryView] || queryView || 'accounts'
  const handleViewChange = (view) => {
    router.push(`/finance?view=${view}`, undefined, { shallow: true })
  }

  return (
    <Tabs value={activeView} onValueChange={handleViewChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-7">
        <TabsTrigger value="accounts">ACCOUNTS</TabsTrigger>
        <TabsTrigger value="transactions">TRANSACTIONS</TabsTrigger>
        <TabsTrigger value="expenses">EXPENSES</TabsTrigger>
        <TabsTrigger value="reports">REPORTS</TabsTrigger>
        <TabsTrigger value="ledger">LEDGER</TabsTrigger>
        <TabsTrigger value="invoices">INVOICES</TabsTrigger>
        <TabsTrigger value="reconciliation">RECONCILE</TabsTrigger>
      </TabsList>
      <TabsContent value="accounts">
        <AccountsTable />
      </TabsContent>
      <TabsContent value="expenses">
        <ExpenseTable />
      </TabsContent>
      <TabsContent value="transactions">
        <TransactionTable />
      </TabsContent>
      <TabsContent value="reports">
        <ReportDash/>
      </TabsContent>
      <TabsContent value="ledger">
        <ReportDash/>
      </TabsContent>
      <TabsContent value="invoices">
        <FinanceLinkPanel
          title="Supplier Invoices"
          description="Supplier invoice workflows remain in the dedicated invoices workspace while their accrual journal entries feed finance reports."
          href="/invoices"
          label="Open Supplier Invoices"
        />
      </TabsContent>
      <TabsContent value="reconciliation">
        <FinanceLinkPanel
          title="Reconciliation"
          description="Review and approve correction cases for sales, transactions, and invoices."
          href="/reconciliation"
          label="Open Reconciliation"
        />
      </TabsContent>
    </Tabs>
  )
}

function FinanceLinkPanel({ title, description, href, label }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={href}>{label}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
