import { Phone, MessageCircle, Send, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function Support() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">POS Pro Support</h1>
          <p className="text-xl text-gray-600">We are here to help you with your POS needs</p>
        </header>

        <div className="grid gap-8 md:grid-cols-2 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="mr-2" />
                Phone Support
              </CardTitle>
              <CardDescription>Call us for immediate assistance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">1-800-POS-HELP</p>
              <p className="text-sm text-gray-500 mt-2">Available Mon-Fri, 9am-5pm EST</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="mr-2" />
                WhatsApp Support
              </CardTitle>
              <CardDescription>Message us for quick responses</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">+1 (555) 123-4567</p>
              <p className="text-sm text-gray-500 mt-2">Available 24/7 for chat support</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Quick answers to common questions</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>How do I set up my POS system?</AccordionTrigger>
                <AccordionContent>
                  Setting up your POS system is easy. First, unpack all components. Connect the main terminal to power, then follow the on-screen instructions to connect to your Wi-Fi network. Finally, log in with your provided credentials and you are ready to go!
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>What payment methods can I accept?</AccordionTrigger>
                <AccordionContent>
                  Our POS system accepts a wide range of payment methods including credit cards (Visa, MasterCard, American Express), debit cards, mobile payments (Apple Pay, Google Pay), and cash. Contact support to enable specific payment methods for your account.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>How do I generate sales reports?</AccordionTrigger>
                <AccordionContent>
                  To generate sales reports, log into your POS dashboard. Navigate to the Reports section, select the type of report you need (e.g., daily sales, inventory), choose your date range, and click Generate. You can view the report on-screen or download it as a PDF or CSV file.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>What should I do if my POS system is not working?</AccordionTrigger>
                <AccordionContent>
                  If your POS system isnt working, first ensure all cables are properly connected and the system is powered on. Try restarting the system. If the issue persists, check your internet connection. For further assistance, please contact our support team via phone or WhatsApp.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submit a Support Request</CardTitle>
            <CardDescription>We will get back to you as soon as possible</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <Input id="name" placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <Input id="email" type="email" placeholder="your@email.com" />
                </div>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                  Message
                </label>
                <Textarea id="message" placeholder="Describe your issue or question" rows={4} />
              </div>
              <Button type="submit" className="w-full">
                <Send className="mr-2 h-4 w-4" /> Send Request
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}