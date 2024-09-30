import React from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

export default function DeleteExpense({expenseId, expenseDescription}) {
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const result = await window.electronAPI.realmOperation('archiveExpense', expenseId);
      if (result.success) {
        toast({
          title: "Success",
          description: `Expense ${expenseDescription} has been deleted.`,
        });
        router.push('/finance');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense. Please try again.",
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
            This action cannot be undone. This will permanently delete the expense
            {expenseDescription && <strong> {expenseDescription}</strong>} and remove its data from our servers.
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