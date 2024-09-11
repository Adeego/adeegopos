'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import useStaffStore from "@/stores/staffStore"
import { useRouter } from 'next/router'

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const addStaff = useStaffStore((state) => state.addStaff)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!phoneNumber || !passcode) {
      setError('Please enter both phone number and passcode.')
      return
    }

    try {
      const response = await window.electronAPI.send('sign-in-staff', phoneNumber, passcode)
      if (response.success) {
        addStaff(response.staff)
        router.push('/')
      } else {
        setError(response.error || 'Invalid credentials')
      }
    } catch (error) {
      setError('An error occurred during sign-in')
      console.error('Sign-in error:', error)
    }
  }

  return (
    <Card className="w-[350px] mx-auto mt-36">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Enter your phone number and passcode to login.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input 
                id="phoneNumber" 
                placeholder="Enter your phone number" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="passcode">Passcode</Label>
              <Input 
                id="passcode" 
                type="password" 
                placeholder="Enter your passcode" 
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col">
        <Button className="w-full" onClick={handleSubmit}>Login</Button>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardFooter>
    </Card>
  )
}
