import React, { useState, useEffect } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import CustomerSearch from './customerSearch';
import ProductVariantSearch from './productVariantSearch';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/use-toast";
import { Plus, Loader2, X, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function AddSubscription({ fetchSubscriptions }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const store = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [formData, setFormData] = useState({
    deliveryDays: [],
    timeSlot: 'morning',
    status: 'active'
  });

  const weekDays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  const handleAddProduct = (product) => {
    // Check if product variant already exists
    const exists = selectedProducts.some(p => p._id === product._id);
    if (exists) {
      toast({
        title: "Product Already Added",
        description: "This product variant is already in the list",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedProducts([...selectedProducts, product]);
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p._id !== productId));
  };

  const handlePriceChange = (productId, newPrice) => {
    setSelectedProducts(selectedProducts.map(p => 
      p._id === productId ? { ...p, unitPrice: parseFloat(newPrice) || 0 } : p
    ));
  };

  const handleDayToggle = (dayValue) => {
    setFormData(prev => ({
      ...prev,
      deliveryDays: prev.deliveryDays.includes(dayValue)
        ? prev.deliveryDays.filter(d => d !== dayValue)
        : [...prev.deliveryDays, dayValue].sort()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCustomer) {
      toast({
        title: "Validation Error",
        description: "Please select a customer",
        variant: "destructive"
      });
      return;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product",
        variant: "destructive"
      });
      return;
    }

    if (formData.deliveryDays.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one delivery day",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    const subscriptionData = {
      storeNo,
      customerId: selectedCustomer._id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phoneNumber,
      products: selectedProducts.map(product => ({
        variantId: product._id,
        productId: product.productId || product._id,
        productName: product.productName || product.name,
        variantName: product.variantName,
        unitPrice: product.unitPrice,
        conversionFactor: product.conversionFactor
      })),
      deliveryDays: formData.deliveryDays,
      timeSlot: formData.timeSlot,
      status: formData.status,
      createdAt: new Date().toISOString(),
      lastDelivery: null,
      nextDelivery: null
    };

    try {
      const result = await window.electronAPI.realmOperation('addSubscription', subscriptionData);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Subscription created successfully"
        });
        
        setSelectedCustomer(null);
        setSelectedProducts([]);
        setFormData({
          deliveryDays: [],
          timeSlot: 'morning',
          status: 'active'
        });
        
        setOpen(false);
        fetchSubscriptions();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create subscription",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast({
        title: "Error",
        description: "An error occurred while creating the subscription",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Create New Subscription</DialogTitle>
          <DialogDescription>
            Set up a recurring delivery subscription for a customer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[calc(85vh-200px)] pr-4">
            <div className="grid gap-4 py-4">
              {/* Customer Selection */}
              <div className="grid gap-2">
                <Label>Customer *</Label>
                <CustomerSearch 
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={setSelectedCustomer}
                />
              </div>

              {/* Product Selection */}
              <div className="grid gap-2">
                <Label>Products *</Label>
                <ProductVariantSearch 
                  onSelectProduct={handleAddProduct}
                  buttonText="Add product variant..."
                />
                
                {/* Selected Products List */}
                {selectedProducts.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {selectedProducts.map((product) => (
                      <div
                        key={product._id}
                        className="flex items-center justify-between p-3 border rounded-md bg-accent/50 gap-3"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {product.productName || product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {product.variantName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={product.unitPrice}
                              onChange={(e) => handlePriceChange(product._id, e.target.value)}
                              className="w-20 h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProduct(product._id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Days */}
              <div className="grid gap-3">
                <Label>Delivery Days *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {weekDays.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.deliveryDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Slot */}
              <div className="grid gap-3">
                <Label>Delivery Time Slot *</Label>
                <RadioGroup 
                  value={formData.timeSlot} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, timeSlot: value }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="morning" id="morning" />
                    <Label htmlFor="morning" className="font-normal cursor-pointer">
                      Morning (9:00 AM - 11:00 AM)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="evening" id="evening" />
                    <Label htmlFor="evening" className="font-normal cursor-pointer">
                      Evening (6:00 PM - 8:00 PM)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
