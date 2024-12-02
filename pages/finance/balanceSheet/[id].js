import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { Edit, Save, Trash2, X } from 'lucide-react';

// Predefined categories for each type
const CATEGORIES = {
  asset: [
    'Cash and Bank Balances', 
    'Accounts Receivable', 
    'Inventory',
    'Prepaid Expenses',
    'Other Current Assets',
    'Property & Equipment',
    'Accumulated Depreciation'
  ],
  liability: [
    'Accounts Payable', 
    'Short-Term Loans',
    'Other Current Liabilities',
    'Long-Term Loans'
  ],
  equity: [
    'Owner\'s Capital', 
    'Retained Earnings'
  ]
}

export default function BalanceSheetDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [editType, setEditType] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (id) {
      fetchBalanceSheetDetail();
    }
  }, [id]);

  const fetchBalanceSheetDetail = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getBalanceSheetById', id);
      if (result.success) {
        setBalanceSheet(result.balanceSheet);
        // Initialize edit form with current values
        setEditType(result.balanceSheet.type);
        setEditCategory(result.balanceSheet.category);
        setEditAmount(result.balanceSheet.amount.toString());
        setEditDescription(result.balanceSheet.description || '');
      } else {
        console.error('Failed to fetch balance sheet details:', result.error);
        toast({
          description: 'Failed to fetch balance sheet details'
        });
      }
    } catch (error) {
      console.error('Error fetching balance sheet details:', error);
      toast({
        description: 'Error fetching balance sheet details'
      });
    }
  };

  const handleUpdate = async () => {
    try {
      const updatedEntry = {
        ...balanceSheet,
        type: editType,
        category: editCategory,
        amount: parseFloat(editAmount),
        description: editDescription
      };

      const result = await window.electronAPI.realmOperation('updateBalanceSheet', updatedEntry);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Balance sheet entry updated successfully"
        });
        
        // Update local state and exit edit mode
        setBalanceSheet(result.balanceSheet);
        setIsEditing(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error updating balance sheet:', error);
      toast({
        title: "Error",
        description: "Failed to update balance sheet entry",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    try {
      const result = await window.electronAPI.realmOperation('archiveBalanceSheet', id);
      if (result.success) {
        toast({
          title: "Success",
          description: "Balance sheet deleted successfully"
        });
        router.push('/finance/balanceSheet');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting balance sheet:', error);
      toast({
        title: "Error",
        description: "Failed to delete balance sheet",
        variant: "destructive"
      });
    }
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    // Reset edit form to current values when canceling
    if (!isEditing) {
      setEditType(balanceSheet.type);
      setEditCategory(balanceSheet.category);
      setEditAmount(balanceSheet.amount.toString());
      setEditDescription(balanceSheet.description || '');
    }
  };

  if (!balanceSheet) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="w-full ">
      <CardHeader className="space-y-1">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl">Balance Sheet Entry</CardTitle>
            <CardDescription>Detailed view and management of entry</CardDescription>
          </div>
          <div className="flex space-x-2">
            {!isEditing ? (
              <Button onClick={toggleEditMode} variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={toggleEditMode}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdate}
                  disabled={!editType || !editCategory || !editAmount}
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this balance sheet entry? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
          {!isEditing ? (
              <dl className="grid grid-cols-3 gap-4">
                {[
                  { label: "Type", value: balanceSheet.type },
                  { label: "Category", value: balanceSheet.category },
                  { label: "Amount", value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(balanceSheet.amount) },
                  { label: "Description", value: balanceSheet.description || "No description" },
                  { label: "Created At", value: format(new Date(balanceSheet.createdAt), 'PPpp') },
                ].map((item, index) => (
                  <div key={index} className="bg-muted p-3 rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground mb-1">{item.label}</dt>
                    <dd className="text-sm font-semibold break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES[editType]?.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input 
                  id="amount"
                  type="number" 
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="Enter amount" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description"
                  type="text" 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter description (optional)" 
                />
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
