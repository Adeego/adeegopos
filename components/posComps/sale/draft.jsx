import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import useDraftSalesStore from '@/stores/draftSales';
import { useToast } from '@/components/ui/use-toast';
import { Archive, Clock, Trash2 } from 'lucide-react';

export default function Draft({ onLoadDraft }) {
  const [isOpen, setIsOpen] = useState(false);
  const drafts = useDraftSalesStore(state => state.drafts);
  const removeDraft = useDraftSalesStore(state => state.removeDraft);
  const { toast } = useToast();

  const handleLoadDraft = (draft) => {
    if (onLoadDraft) {
      onLoadDraft(draft);
      removeDraft(draft.id);
      toast({
        title: "Draft Loaded",
        description: "The draft sale has been loaded successfully"
      });
      setIsOpen(false);
    }
  };

  const handleRemoveDraft = (draftId) => {
    removeDraft(draftId);
    toast({
      title: "Draft Removed",
      description: "The draft sale has been removed"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Archive className="h-4 w-4" />
          Drafted Sales [{drafts.length}]
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Drafted Sales</DialogTitle>
          <DialogDescription>List of saved draft sales</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Archive className="h-12 w-12 mb-2" />
              <p>No draft sales available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <Card key={draft.id} className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold">
                        {draft.customer ? draft.customer.name : 'No Customer'}
                      </h4>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        KES {draft.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {draft.selectedProducts.length} items
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveDraft(draft.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleLoadDraft(draft)}
                    >
                      Load Draft
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
