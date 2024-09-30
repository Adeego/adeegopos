import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import DeleteExpense from '@/components/financeComps/expense/deleteExpense';

export default function ExpenseDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [expense, setExpense] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchExpenseDetail();
    }
  }, [id]);

  const fetchExpenseDetail = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getExpenseById', id);
      if (result.success) {
        setExpense(result.expense);
      } else {
        console.error('Failed to fetch expense details:', result.error);
        toast({
          description: 'Failed to fetch expense details'
        });
      }
    } catch (error) {
      console.error('Error fetching expense details:', error);
      toast({
        description: 'Error fetching expense details'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setExpense({ ...expense, [name]: value });
  };

  const handleSave = async () => {
    try {
      const result = await window.electronAPI.realmOperation('updateExpense', {
        ...expense,
        updatedAt: new Date().toISOString(),
      });
      if (result.success) {
        setIsEditing(false);
        toast({
          description: 'Expense details updated successfully'
        });
      } else {
        console.error('Failed to update expense:', result.error);
        toast({
          description: 'Failed to update expense details'
        });
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      toast({
        description: 'Error updating expense details'
      });
    }
  };

  if (!expense) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="w-full bg-white shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-2xl font-semibold text-gray-800">Expense Details</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            This expense was recorded on {new Date(expense.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" value={expense.description} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" name="amount" type="number" value={expense.amount} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" value={new Date(expense.date).toISOString().split('T')[0]} onChange={handleInputChange} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">DESCRIPTION</div>
                  <div className="text-sm font-semibold text-gray-900">{expense.description}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">AMOUNT</div>
                  <div className="text-sm font-semibold text-gray-900">KES {expense.amount}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">DATE</div>
                  <div className="text-sm font-semibold text-gray-900">{new Date(expense.date).toLocaleDateString()}</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 border-t border-gray-200 p-6">
          <div className="w-full flex justify-between">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)}>Edit</Button>
                <DeleteExpense expenseId={expense._id} expenseDescription={expense.description} />
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}