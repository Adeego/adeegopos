import React from 'react'
import { useToast } from '../ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Trash2 } from 'lucide-react';

export default function DeleteProduct({onDeleteSuccess, productId, productName}) {
    const { toast } = useToast();

    const handleDelete = async () => {
        try {
          const result = await window.electronAPI.realmOperation('deleteProduct', productId);
      
          if (result && result.success) {
            toast({
              title: "Success",
              description: `Product ${productName} has been deleted.`,
            });
            onDeleteSuccess();
          } else {
            throw new Error(result && result.error ? result.error : 'Failed to delete product');
          }
        } catch (error) {
          console.error('Error deleting product:', error);
          toast({
            title: "Error",
            description: error.message || "Failed to delete product. Please try again.",
            variant: "destructive",
          });
        }
      };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div variant="ghost" size="icon">
          <Trash2 className="h-4 w-4" /> Delete
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the customer
            {productName && <strong> {productName}</strong>} and remove their data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
