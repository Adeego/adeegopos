import React from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

export default function DeleteTransaction({onDeleteSuccess, transactionId, transactionDescription}) {
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const result = await window.electronAPI.realmOperation('archiveTransaction', transactionId);
      if (result.success) {
        toast({
          title: "Success",
          description: `Transaction ${transactionDescription} has been deleted.`,
        });
        router.push("/finance");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete transaction. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div className="flex items-center justify-center bg-red-500 text-white rounded-md p-2">
          <p className="text-white font-semibold">Delete</p>
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the transaction
            {transactionDescription && <strong> {transactionDescription}</strong>} and remove its data from our servers.
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