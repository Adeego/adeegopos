import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';

export default function SupplierDetail() {
  const router = useRouter();
  const { id } = router.query;
  const {toast} = useToast();
  const [supplier, setSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSupplierDetail();
    }
  }, [id]);

  const fetchSupplierDetail = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getSupplierById', id);
      if (result.success) {
        setSupplier(result.supplier);
      } else {
        console.error('Failed to fetch supplier details:', result.error);
        toast.error('');
        toast({
          description: 'Failed to fetch supplier details'
        });
      }
    } catch (error) {
      console.error('Error fetching supplier details:', error);
      toast({
        description: 'Error fetching supplier details'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSupplier({ ...supplier, [name]: value });
  };

  const handleCategoryChange = (value) => {
    setSupplier({ ...supplier, category: value });
  };

  const handleSave = async () => {
    try {
      const result = await window.electronAPI.realmOperation('updateSupplier', {
        ...supplier,
        updatedAt: new Date().toISOString(),
      });
      if (result.success) {
        setIsEditing(false);
        toast({
          description: 'Supplier details updated successfully'
        });
      } else {
        console.error('Failed to update supplier:', result.error);
        toast({
          description: 'Failed to update supplier details'
        });
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        description: 'Error updating supplier details'
      });
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        const result = await window.electronAPI.realmOperation('archiveSupplier', id);
        if (result.success) {
          toast({
            description: 'Supplier deleted successfully'
          });
          router.push('/supplier');
        } else {
          console.error('Failed to delete supplier:', result.error);
          toast({
            description: 'Failed to delete supplier'
          });
        }
      } catch (error) {
        console.error('Error deleting supplier:', error);
        toast({
          description: 'Error deleting supplier', error
        });
      }
    }
  };

  if (!supplier) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="w-full bg-white shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-2xl font-semibold text-gray-800">Supplier Details</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            This supplier was added on {new Date(supplier.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" value={supplier.name} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="contact">Phone Number</Label>
                  <Input id="contact" name="contact" value={supplier.phoneNumber} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={supplier.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Groceries">Groceries</SelectItem>
                      <SelectItem value="Clothing">Clothing</SelectItem>
                      <SelectItem value="Furniture">Furniture</SelectItem>
                      <SelectItem value="Stationery">Stationery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">NAME</div>
                  <div className="text-sm font-semibold text-gray-900">{supplier.name}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">PHONE NUMBER</div>
                  <div className="text-sm font-semibold text-gray-900">{supplier.phoneNumber}</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-600">BALANCE</div>
                  <div className="text-sm font-semibold text-gray-900">{supplier.balance}</div>
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
                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
