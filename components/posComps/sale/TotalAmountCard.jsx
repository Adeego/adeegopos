import React, { useState, useCallback } from 'react';
import useDraftSalesStore from '@/stores/draftSales';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function TotalAmountCard({ totalAmount, onNext, selectedProducts, customer, paymentMethod, saleType, fulfillmentType, servedBy, note, transactionCost, paymentBreakdown, onClearSale }) {
    const [isHovered, setIsHovered] = useState(false);
    const addDraft = useDraftSalesStore(state => state.addDraft);
    const { toast } = useToast();

    const handleDraft = useCallback(() => {
      if (selectedProducts.length === 0) {
        toast({
          title: "Error",
          description: "No products selected to save as draft",
          variant: "destructive"
        });
        return;
      }
      
      const draftData = {
        selectedProducts,
        customer,
        totalAmount,
        paymentMethod,
        saleType,
        fulfillmentType,
        servedBy,
        note,
        transactionCost,
        paymentBreakdown
      };
      
      addDraft(draftData);
      toast({
        title: "Success",
        description: "Sale saved as draft"
      });
      
      // Clear the current sale
      if (onClearSale) {
        onClearSale();
      }
    }, [selectedProducts, customer, totalAmount, paymentMethod, saleType, fulfillmentType, servedBy, note, transactionCost, paymentBreakdown, addDraft, onClearSale, toast]);

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
          </div>
        </div>

        <div className="flex justify-between items-center gap-4">
          <Button
            onClick={handleDraft}
            variant="outline"
            className="flex-1 h-12 text-base font-medium"
            disabled={selectedProducts.length === 0}
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
