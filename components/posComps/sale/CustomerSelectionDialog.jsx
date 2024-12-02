import React from 'react';
import { Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

function CustomerSelectionDialog({ 
  open, 
  onOpenChange, 
  name, 
  onNameChange, 
  customerResult, 
  onCustomerSelect,
  selectedCustomer 
}) {
  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription>
            Search and select a customer for this sale
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search customers..."
            value={name}
            onChange={onNameChange}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {customerResult && customerResult.length > 0 ? (
          <ScrollArea className="h-[200px]">
            {customerResult.map((chosenCustomer) => (
              <div
                key={chosenCustomer._id}
                role="option"
                className="cursor-pointer px-3 py-2 hover:bg-accent"
                onClick={() => onCustomerSelect(chosenCustomer)}
              >
                <div className="font-medium">{chosenCustomer.name}</div>
                <div className="text-sm text-muted-foreground">
                  {chosenCustomer.phoneNumber}
                </div>
              </div>
            ))}
          </ScrollArea>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No results found
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomerSelectionDialog;
