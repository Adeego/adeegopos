'use client'

import { useEffect, useState } from 'react'
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
  const [streamedAnalysis, setStreamedAnalysis] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const performAiAnalysis = async () => {
    setIsLoading(true);
    setStreamedAnalysis("");
    setError("");

    window.electronAPI.aiAnalysis(
      metrics,
      (chunk) => {
        setStreamedAnalysis((prev) => prev + chunk);
      },
      () => {
        setIsLoading(false);
      },
      (error) => {
        console.error('Error generating AI analysis:', error);
        setError('Failed to generate AI analysis');
        setIsLoading(false);
      }
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={performAiAnalysis} disabled={isLoading}>
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
              {isLoading ? (
                <p className="animate-pulse">Generating analysis...</p>
              ) : (
                <p>{streamedAnalysis}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
