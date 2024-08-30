import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

export default function ViewCustomer({customer}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-8">
        <Card className="w-full md:w-1/2 bg-white shadow-lg rounded-lg overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-2xl font-semibold text-gray-800">Customer Info</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              This customer joined us on {new Date(customer.createdAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[
                { label: "NAME", value: customer.name },
                { label: "PHONE NUMBER", value: customer.phoneNumber },
                { label: "ADDRESS", value: customer.address },
                { label: "CREDIT", value: customer.credit ? "YES" : "NO" },
                { label: "STATUS", value: customer.status },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">{item.label}</div>
                  <div className="text-sm font-semibold text-gray-900">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="w-full md:w-1/2 bg-white shadow-lg rounded-lg overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-2xl font-semibold text-gray-800">Balance & Insights</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="text-3xl font-bold text-gray-900">KSH {customer.balance}</div>
              <div className="text-sm text-gray-600 mt-1">Current Balance</div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-600">LAST PAYMENT</div>
                <div className="text-lg font-semibold text-gray-900">KSH 2,500</div>
                <div className="text-sm text-gray-600">2023-09-09</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">CREDIT LIMIT</div>
                <div className="text-lg font-semibold text-gray-900">KSH 10,000</div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="w-full">
              <div className="text-lg font-semibold text-gray-800 mb-4">INSIGHTS</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">8</div>
                  <div className="text-sm text-gray-600">Times Bought</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">KSH 2,000</div>
                  <div className="text-sm text-gray-600">Avg. Transaction</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">KSH 86,000</div>
                  <div className="text-sm text-gray-600">Total Transactions</div>
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Sales History</h2>
        <p className="text-gray-600">Sales data will be added here</p>
      </div>
    </div>
  )
}
