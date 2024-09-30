import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Configure this component to work with the salesHistory.js component
export default function ArchiveSale({ saleId, onDeleteSuccess }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await window.electronAPI.realmOperation('archiveSale', saleId);

      if (result && result.success) {
        toast({
          title: "Success",
          description: `The sale has been deleted.`,
        });
        onDeleteSuccess();
      } else {
        throw new Error(result && result.error ? result.error : 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete sale. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div variant="ghost" size="icon" className='flex justify-center items-center rounded-md hover:bg-neutral-200 h-8 w-8' >
          <Trash2 className=" text-red-700" />
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this and remove their data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}