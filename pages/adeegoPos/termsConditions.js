import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function TermsConditions() {
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Terms and Conditions</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] w-full pr-4">
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
              <p>By using our convenience store point of sale (POS) system, you agree to these Terms and Conditions. If you do not agree, please do not use our system.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Use of the POS System</h2>
              <p>Our POS system is designed for use in convenience store operations. You agree to use it only for its intended purpose and in compliance with all applicable laws and regulations.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Payment Processing</h2>
              <p>We facilitate payment processing through our POS system. You are responsible for ensuring the accuracy of all transactions and complying with payment card industry (PCI) standards.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Data Privacy and Security</h2>
              <p>We take data privacy seriously. You agree to handle customer data in accordance with our privacy policy and all applicable data protection laws.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. System Updates and Maintenance</h2>
              <p>We may perform system updates and maintenance from time to time. We will strive to minimize disruptions, but some downtime may occur.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Liability</h2>
              <p>We provide this POS system "as is" and make no warranties, express or implied. We shall not be liable for any indirect, incidental, special, consequential or punitive damages.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">7. Termination</h2>
              <p>We reserve the right to terminate or suspend access to our POS system for any reason, including violation of these terms.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">8. Changes to Terms</h2>
              <p>We may update these terms from time to time. Continued use of the POS system after changes constitutes acceptance of the new terms.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">9. Contact Information</h2>
              <p>If you have any questions about these Terms and Conditions, please contact us at support@conveniencepos.com.</p>
            </section>

            <p className="text-sm text-muted-foreground mt-6">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}