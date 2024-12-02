import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowRight } from "lucide-react";

// Dummy detailed data for each report type
const reportDetails = {
  "Income statement": {
    totalRevenue: "KES 2,500,000",
    totalExpenses: "KES 500,000",
    netIncome: "KES 2,000,000",
    breakdown: [
      { category: "Product Sales", amount: "KES 1,800,000" },
      { category: "Service Revenue", amount: "KES 700,000" },
      { category: "Cost of Goods Sold", amount: "KES -300,000" },
      { category: "Operating Expenses", amount: "KES -200,000" }
    ]
  },
  "Chart of Accounts": {
    totalAccounts: 15,
    accountTypes: [
      { type: "Assets", count: 5, total: "KES 3,500,000" },
      { type: "Liabilities", count: 3, total: "KES 1,200,000" },
      { type: "Equity", count: 2, total: "KES 2,100,000" },
      { type: "Revenue", count: 3, total: "KES 2,500,000" },
      { type: "Expenses", count: 2, total: "KES 700,000" }
    ]
  },
  "Statement of Accounts": {
    openingBalance: "KES 4,500,000",
    closingBalance: "KES 5,000,000",
    transactions: [
      { date: "2023-06-01", description: "Sales Revenue", amount: "+KES 750,000" },
      { date: "2023-06-05", description: "Inventory Purchase", amount: "-KES 250,000" },
      { date: "2023-06-10", description: "Utility Expenses", amount: "-KES 50,000" }
    ]
  },
  "Balance Sheet Summary": {
    currentAssets: "KES 3,200,000",
    nonCurrentAssets: "KES 1,600,000",
    totalAssets: "KES 4,800,000",
    currentLiabilities: "KES 1,000,000",
    longTermLiabilities: "KES 500,000",
    totalLiabilities: "KES 1,500,000",
    shareholdersEquity: "KES 3,300,000"
  },
  "Trial Balance": {
    status: "Balanced",
    totalDebits: "KES 0",
    totalCredits: "KES 0",
    accounts: [
      { name: "Cash", debit: "KES 500,000", credit: "KES 0" },
      { name: "Accounts Receivable", debit: "KES 300,000", credit: "KES 0" },
      { name: "Inventory", debit: "KES 200,000", credit: "KES 0" },
      { name: "Sales Revenue", debit: "KES 0", credit: "KES 1,000,000" }
    ]
  }
};

function ReportCard({ title, value, icon, description }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const details = reportDetails[title];

    const renderDetails = () => {
      switch(title) {
        case "Income statement":
          return (
            <div>
              <p>Total Revenue: {details.totalRevenue}</p>
              <p>Total Expenses: {details.totalExpenses}</p>
              <p>Net Income: {details.netIncome}</p>
              <h3 className="mt-4 font-bold">Breakdown</h3>
              {details.breakdown.map((item, index) => (
                <div key={index} className="flex justify-between mb-2">
                  <span>{item.category}</span>
                  <span>{item.amount}</span>
                </div>
              ))}
            </div>
          );
        case "Chart of Accounts":
          return (
            <div>
              <p>Total Accounts: {details.totalAccounts}</p>
              <h3 className="mt-4 font-bold">Account Types</h3>
              {details.accountTypes.map((account, index) => (
                <div key={index} className="flex justify-between mb-2">
                  <span>{account.type}</span>
                  <span>{account.count} accounts, Total: {account.total}</span>
                </div>
              ))}
            </div>
          );
        case "Statement of Accounts":
          return (
            <div>
              <p>Opening Balance: {details.openingBalance}</p>
              <p>Closing Balance: {details.closingBalance}</p>
              <h3 className="mt-4 font-bold">Transactions</h3>
              {details.transactions.map((transaction, index) => (
                <div key={index} className="flex justify-between mb-2">
                  <span>{transaction.date}</span>
                  <span>{transaction.description}</span>
                  <span>{transaction.amount}</span>
                </div>
              ))}
            </div>
          );
        case "Balance Sheet Summary":
          return (
            <div>
              <h3 className="font-bold">Assets</h3>
              <div className="flex justify-between mb-2">
                <span>Current Assets</span>
                <span>{details.currentAssets}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Non-Current Assets</span>
                <span>{details.nonCurrentAssets}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span>Total Assets</span>
                <span>{details.totalAssets}</span>
              </div>
              
              <h3 className="font-bold">Liabilities</h3>
              <div className="flex justify-between mb-2">
                <span>Current Liabilities</span>
                <span>{details.currentLiabilities}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Long-Term Liabilities</span>
                <span>{details.longTermLiabilities}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span>Total Liabilities</span>
                <span>{details.totalLiabilities}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Shareholders Equity</span>
                <span>{details.shareholdersEquity}</span>
              </div>
            </div>
          );
        case "Trial Balance":
          return (
            <div>
              <p>Status: {details.status}</p>
              <p>Total Debits: {details.totalDebits}</p>
              <p>Total Credits: {details.totalCredits}</p>
              <h3 className="mt-4 font-bold">Accounts</h3>
              <div className="grid grid-cols-3 font-bold mb-2">
                <span>Account</span>
                <span>Debit</span>
                <span>Credit</span>
              </div>
              {details.accounts.map((account, index) => (
                <div key={index} className="grid grid-cols-3 mb-2">
                  <span>{account.name}</span>
                  <span>{account.debit}</span>
                  <span>{account.credit}</span>
                </div>
              ))}
            </div>
          );
        default:
          return <p>No details available</p>;
      }
    };

    return (
      <>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row justify-between items-center border-b border-gray-200 bg-gray-50 p-4">
            <CardTitle className="text-xl font-semibold text-gray-500">{title}</CardTitle>
            <Button 
              variant="ghost" 
              className="text-gray-500" 
              onClick={() => setIsDialogOpen(true)}
            >
              <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="rounded-full bg-gray-100 p-2">{icon}</span>
                <span className="text-2xl font-bold">{value}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">{description}</p>
          </CardContent>
        </Card>
      </>
    )
}

export default ReportCard;
