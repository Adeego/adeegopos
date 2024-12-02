'use client'

import { useState } from 'react'
import OpenAI from 'openai'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function AiAnalysis({ metrics }) {
  const [isOpen, setIsOpen] = useState(false)
  const [analysis, setAnalysis] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // This is the structure of metrics data
  // const metrics = {
  //   revenue: salesData.revenue,
  //   numberOfSales: salesData.numberOfSales,
  //   profit: salesData.profit,
  //   expense: expense,
  //   customerCredit: salesData.customerCredit,
  //   customerCredits: transaction.customerCredits,
  //   supplierPayments: transaction.supplierPayments,
  //   cashflow: cashflow
  // }

  // Initialize OpenAI client

  const generateAnalysis = async () => {
    setError('')
    setIsLoading(true)
    setAnalysis("")
    setIsOpen(true)

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a retail business analyst. Analyze the provided store data and provide actionable insights. The currency is KES (Kenya shillings).The analysis should be in 200 words not more. The analysis should be in English language`
          },
          {
            role: "user",
            content: `Analyze these store metrics:
              Revenue: ${metrics.revenue}
              Number of Sales: ${metrics.numberOfSales}
              Profit: ${metrics.profit}
              Expenses: ${metrics.expense}
              Customer Credits: ${metrics.customerCredit}
              Credits Paid: ${metrics.customerCredits}
              Supplier Payments: ${metrics.supplierPayments}
              Cashflow: ${metrics.cashflow}`
          }
        ],
        stream: true
      })

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || ""
        setAnalysis((prev) => prev + content)
      }

    } catch (error) {
      setError('Failed to generate analysis. Please try again.')
      console.error('Error generating analysis:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={generateAnalysis} disabled={isLoading}>
          {isLoading ? "Analyzing..." : "Generate AI Analysis"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Business Analysis</DialogTitle>
          <DialogDescription>
            Real-time analysis of your business metrics
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 whitespace-pre-wrap">
          {error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <div className="prose prose-sm">
              {analysis}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
