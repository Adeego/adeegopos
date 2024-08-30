// components/posComps/VariantSelection.jsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

function VariantSelection({ isOpen, onClose, product, onVariantSelect }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Product Variant</DialogTitle>
          <DialogDescription>Choose a variant for {product?.name}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[300px] mt-4">
          {product?.variants.map((variant) => (
            <Button
              key={variant._id}
              onClick={() => onVariantSelect(variant)}
              className="w-full mb-2"
            >
              {variant.name} - {variant.unitPrice.toFixed(2)}
            </Button>
          ))}
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VariantSelection;
