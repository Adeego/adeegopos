import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  Package, 
  User, 
  Phone, 
  DollarSign,
  Info,
  TrendingUp
} from "lucide-react";

export default function SubscriptionDetails({ subscription }) {
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-500',
      paused: 'bg-yellow-500',
      cancelled: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getDaysDisplay = (days) => {
    return days.map(day => weekDays[day]).join(', ');
  };

  const getTimeSlotDisplay = (timeSlot) => {
    return timeSlot === 'morning' 
      ? '9:00 AM - 11:00 AM' 
      : '6:00 PM - 8:00 PM';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="h-4 w-4 mr-1" />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Subscription Details
          </DialogTitle>
          <DialogDescription>
            View complete subscription information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
              <div className={`h-2 w-2 rounded-full ${getStatusColor(subscription.status)} mr-2`}></div>
              {subscription.status}
            </Badge>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </h4>
            <div className="ml-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{subscription.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {subscription.customerPhone}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Product Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products ({subscription.products?.length || 0})
            </h4>
            <div className="ml-6 space-y-3">
              {subscription.products && subscription.products.length > 0 ? (
                subscription.products.map((product, idx) => (
                  <div key={idx} className="p-2 border rounded-md bg-accent/30">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{product.productName}</span>
                      <span className="font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {product.unitPrice}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Variant: {product.variantName}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No products added</div>
              )}
            </div>
          </div>

          <Separator />

          {/* Schedule Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Delivery Schedule
            </h4>
            <div className="ml-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days:</span>
                <span className="font-medium text-right max-w-[200px]">
                  {getDaysDisplay(subscription.deliveryDays)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time Slot:</span>
                <span className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {getTimeSlotDisplay(subscription.timeSlot)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frequency:</span>
                <span className="font-medium">
                  {subscription.deliveryDays.length}x per week
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery History */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              History
            </h4>
            <div className="ml-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">{formatDate(subscription.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="font-medium">{formatDate(subscription.updatedAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Delivery:</span>
                <span className="font-medium">{formatDate(subscription.lastDelivery)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
