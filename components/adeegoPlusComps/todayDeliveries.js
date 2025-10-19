import React, { useEffect, useState } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import useDraftSalesStore from '@/stores/draftSales';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Calendar, CheckCircle, Clock, Package, Loader2, XCircle, SkipForward } from "lucide-react";

export default function TodayDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const store = useWsinfoStore((state) => state.wsinfo);
  const addDraft = useDraftSalesStore((state) => state.addDraft);
  const [storeNo, setStoreNo] = useState('');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (storeNo) {
      fetchTodayDeliveries();
    }
  }, [storeNo]);

  const fetchTodayDeliveries = async () => {
    try {
      const today = new Date().getDay(); // 0-6, Sunday-Saturday
      const result = await window.electronAPI.realmOperation('getTodayDeliveries', storeNo, today);
      
      if (result.success) {
        setDeliveries(result.deliveries || []);
      }
    } catch (error) {
      console.error('Error fetching today\'s deliveries:', error);
    }
  };

  const handleMarkAsDelivered = async (delivery) => {
    setLoading(true);
    
    try {
      // Convert subscription products to draft sale format
      const selectedProducts = delivery.products && delivery.products.length > 0
        ? delivery.products.map(product => ({
            _id: product.variantId,
            productId: product.productId,
            name: product.variantName,
            productName: product.productName,
            variantName: product.variantName,
            unitPrice: product.unitPrice,
            conversionFactor: product.conversionFactor,
            quantity: 1,
            total: product.unitPrice * 1
          }))
        : [];
      
      const totalAmount = selectedProducts.reduce((sum, item) => sum + item.total, 0);

      // Create draft sale data matching POS draft format
      const draftData = {
        selectedProducts,
        customer: {
          _id: delivery.customerId,
          name: delivery.customerName,
          phoneNumber: delivery.customerPhone
        },
        totalAmount,
        paymentMethod: null,
        saleType: null,
        fulfillmentType: null,
        servedBy: null,
        note: `Adeego Plus delivery - ${delivery.timeSlot === 'morning' ? 'Morning' : 'Evening'} slot`,
        source: 'adeegoplus',
        subscriptionId: delivery._id
      };

      // Add to draft sales store (localStorage)
      addDraft(draftData);
      
      // Update delivery status in database
      const updateResult = await window.electronAPI.realmOperation('updateDeliveryStatus', {
        subscriptionId: delivery._id,
        status: 'delivered',
        deliveryDate: new Date().toISOString()
      });

      if (updateResult.success) {
        toast({
          title: "Success",
          description: `Delivery added to draft sales (${selectedProducts.length} products)`
        });
        fetchTodayDeliveries();
      }
    } catch (error) {
      console.error('Error marking delivery:', error);
      toast({
        title: "Error",
        description: "Failed to process delivery",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipDelivery = async (delivery, skipReason) => {
    setLoading(true);
    
    try {
      const result = await window.electronAPI.realmOperation('updateDeliveryStatus', {
        subscriptionId: delivery._id,
        status: 'skipped',
        skipReason,
        skipDate: new Date().toISOString()
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Delivery skipped successfully"
        });
        fetchTodayDeliveries();
      }
    } catch (error) {
      console.error('Error skipping delivery:', error);
      toast({
        title: "Error",
        description: "Failed to skip delivery",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTimeSlotBadge = (timeSlot) => {
    const isEvening = timeSlot === 'evening';
    return (
      <Badge variant={isEvening ? "secondary" : "default"}>
        <Clock className="h-3 w-3 mr-1" />
        {isEvening ? '6:00 PM - 8:00 PM' : '9:00 AM - 11:00 AM'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Today's Deliveries
        </CardTitle>
        <CardDescription>
          Manage scheduled deliveries for today
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deliveries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No deliveries scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <div
                key={delivery._id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{delivery.customerName}</h4>
                    {getTimeSlotBadge(delivery.timeSlot)}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <span>{delivery.customerPhone}</span>
                    </div>
                    {delivery.products && delivery.products.length > 0 ? (
                      delivery.products.map((product, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Package className="h-3 w-3" />
                          <span>{product.productName} ({product.variantName})</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>No products</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleMarkAsDelivered(delivery)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Deliver
                      </>
                    )}
                  </Button>
                  
                  <SkipDeliveryDialog 
                    delivery={delivery} 
                    onSkip={handleSkipDelivery}
                    loading={loading}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkipDeliveryDialog({ delivery, onSkip, loading }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('customer_request');

  const reasons = [
    { value: 'customer_request', label: 'Customer requested to skip' },
    { value: 'take_tomorrow', label: 'Customer wants it tomorrow' },
    { value: 'customer_not_available', label: 'Customer not available' },
    { value: 'product_unavailable', label: 'Product unavailable' }
  ];

  const handleSkip = () => {
    onSkip(delivery, reason);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <SkipForward className="h-4 w-4 mr-1" />
          Skip
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip Delivery</DialogTitle>
          <DialogDescription>
            Select a reason for skipping this delivery for {delivery.customerName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            {reasons.map((r) => (
              <label
                key={r.value}
                className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-accent"
              >
                <input
                  type="radio"
                  name="skip-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSkip} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Skip Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
