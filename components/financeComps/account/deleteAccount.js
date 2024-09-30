import React from 'react'
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

export default function DeleteAccount({accountId, accountName}) {
    const { toast } = useToast();
    const router = useRouter();

    // const handleDelete = async () => {
    //   try {
    //     const result = await window.electronAPI.realmOperation('deleteProduct', accountId);
    
    //     if (result && result.success) {
    //       toast({
    //         title: "Success",
    //         description: `Product ${accountName} has been deleted.`,
    //       });
    //       onDeleteSuccess();
    //     } else {
    //       throw new Error(result && result.error ? result.error : 'Failed to delete product');
    //     }
    //   } catch (error) {
    //     console.error('Error deleting product:', error);
    //     toast({
    //       title: "Error",
    //       description: error.message || "Failed to delete product. Please try again.",
    //       variant: "destructive",
    //     });
    //   }
    // };

    const handleDelete = async () => {
      try {
        const result = await window.electronAPI.realmOperation('archiveAccount', accountId);
        if (result.success) {
          toast({
            title: "Success",
            description: `Product ${accountName} has been deleted.`,
          });
          router.push('/finance');
        } else {
          console.error('Failed to delete account:', result.error);
          toast({
            title: "Error",
            description: error.message || "Failed to delete account. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error deleting account:', error);
        toast({
          description: 'Error deleting account', error
        });
      }
    };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div className="flex items-center justify-center bg-red-500 text-white rounded-md p-2">
          {/* <Trash2 className="h-4 w-4 mr-1" />  */}
          <p className="text-white font-semibold">Delete</p>
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the account
            {accountName && <strong> {accountName}</strong>} and remove their data from our servers.
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