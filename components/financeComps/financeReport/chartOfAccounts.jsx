import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowRight, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const AccountItem = ({ code, name }) => (
  <div className="flex items-center space-x-3 py-2 px-4 hover:bg-gray-50 rounded-md transition-colors">
    <FileText className="h-4 w-4 text-gray-400" />
    <span className="text-sm font-medium text-gray-700">{code}</span>
    <span className="text-sm text-gray-600">{name}</span>
  </div>
);

const AccountSection = ({ title, code, accounts }) => (
  <AccordionItem value={code}>
    <AccordionTrigger className="hover:no-underline">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-semibold text-gray-700">{code}</span>
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div className="space-y-1">
        {Object.entries(accounts).map(([key, account]) => (
          <AccountItem key={account.code} code={account.code} name={account.name} />
        ))}
      </div>
    </AccordionContent>
  </AccordionItem>
);

const AccountCategory = ({ title, data }) => {
  if (!data) return null;
  
  return (
    <Card className="p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900 flex items-center">
        <ChevronRight className="h-5 w-5 mr-2 text-blue-500" />
        {title}
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {Object.entries(data).map(([key, section]) => {
          if (key === 'code') return null;
          if (section.accounts) {
            return (
              <AccountSection
                key={section.code}
                title={key.replace(/([A-Z])/g, ' $1').trim()}
                code={section.code}
                accounts={section.accounts}
              />
            );
          }
          return null;
        })}
      </Accordion>
    </Card>
  );
};

export default function ChartOfAccounts({ data }) {
  if (!data) return <div>No chart of accounts data available</div>;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Chart of Accounts</DialogTitle>
          <DialogDescription className="text-gray-600">
            A comprehensive overview of your financial structure
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[70vh] w-full rounded-md border p-4">
          <div className="space-y-6">
            <AccountCategory title="Assets" data={data.assets} />
            <AccountCategory title="Liabilities" data={data.liabilities} />
            <AccountCategory title="Equity" data={data.equity} />
            <AccountCategory title="Revenue" data={data.revenue} />
            <AccountCategory title="Expenses" data={data.expenses} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

