import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { CreditCard, Package, Store } from "lucide-react"

export default function Subscription() {
  const [currentPlan, setCurrentPlan] = useState("basic")
  const [autoRenew, setAutoRenew] = useState(true)

  const plans = [
    { id: "basic", name: "Basic", price: 9.99, features: ["1 POS Terminal", "Basic Inventory Management", "24/7 Support"] },
    { id: "standard", name: "Standard", price: 19.99, features: ["3 POS Terminals", "Advanced Inventory Management", "Sales Analytics", "24/7 Priority Support"] },
    { id: "premium", name: "Premium", price: 39.99, features: ["Unlimited POS Terminals", "Advanced Inventory Management", "Sales & Customer Analytics", "24/7 Priority Support", "Custom Integrations"] },
  ]

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Subscription Management</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Your current plan and billing details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              <span className="font-semibold">{plans.find(p => p.id === currentPlan)?.name} Plan</span>
            </div>
            <span className="text-muted-foreground">${plans.find(p => p.id === currentPlan)?.price}/month</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              <span>Next billing date: July 1, 2023</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-renew"
                checked={autoRenew}
                onCheckedChange={setAutoRenew}
              />
              <Label htmlFor="auto-renew">Auto-renew</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Choose the plan that best fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={currentPlan} onValueChange={setCurrentPlan} className="space-y-4">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-center space-x-2 border rounded-lg p-4">
                <RadioGroupItem value={plan.id} id={plan.id} />
                <Label htmlFor={plan.id} className="flex-grow">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{plan.name}</span>
                    <span>${plan.price}/month</span>
                  </div>
                  <ul className="text-sm text-muted-foreground">
                    {plan.features.map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter>
          <Button className="w-full">
            {currentPlan === "basic" ? "Upgrade Plan" : currentPlan === "premium" ? "Downgrade Plan" : "Change Plan"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>Update your billing details and payment method</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cardName">Name on Card</Label>
              <Input id="cardName" placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input id="expiryDate" placeholder="MM/YY" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input id="cvv" placeholder="123" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full">Update Billing Information</Button>
        </CardFooter>
      </Card>

      {/* <div className="mt-8 text-center">
        <Button variant="outline" className="text-destructive">
          Cancel Subscription
        </Button>
      </div> */}
    </div>
  )
}