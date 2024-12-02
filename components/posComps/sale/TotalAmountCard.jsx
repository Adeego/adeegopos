import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Save } from 'lucide-react';

function TotalAmountCard({ totalAmount, onDraft, onNext }) {
    const [isHovered, setIsHovered] = useState(false)

  return (
    <Card className="w-[320px] max-w-md">
      <CardContent className="p-2 space-y-2">
        <div className="space-y-2">
          <Label htmlFor="total-amount" className="text-sm font-medium text-muted-foreground">
            Total Amount (KES)
          </Label>
          <div 
            className="relative overflow-hidden rounded-lg transition-all duration-300 ease-in-out"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Input
              id="total-amount"
              className="text-5xl font-bold text-center h-20 bg-primary/5 border-none"
              value={totalAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
              readOnly
            />
            {/* {isHovered && (
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center text-primary-foreground">
                <span className="text-sm font-medium">Total Amount</span>
              </div>
            )} */}
          </div>
        </div>

        <div className="flex justify-between items-center gap-4">
          <Button
            onClick={onDraft}
            variant="outline"
            className="flex-1 h-12 text-base font-medium"
          >
            <Save className="w-5 h-5 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={onNext}
            className="flex-1 h-12 text-base font-medium"
          >
            Next
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default TotalAmountCard;
