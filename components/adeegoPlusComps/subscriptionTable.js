import React, { useState, useEffect } from 'react';
import useStaffStore from '@/stores/staffStore';
import useWsinfoStore from '@/stores/wsinfo';
import AddSubscription from './addSubscription';
import EditSubscription from './editSubscription';
import DeleteSubscription from './deleteSubscription';
import SubscriptionDetails from './subscriptionDetails';

import { MoreHorizontal, Search, Calendar, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { can } from '@/lib/rbac';

export default function SubscriptionTable() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const staff = useStaffStore((state) => state.staff);
  const canManageSubscriptions = can(staff, 'subscription:manage');
  const store = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState('');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (storeNo) {
      fetchSubscriptions();
    }
  }, [storeNo]);

  useEffect(() => {
    const filtered = subscriptions.filter(subscription => {
      const matchesCustomer = subscription.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(subscription.customerPhone).includes(searchTerm);
      
      // Check if any product matches
      const matchesProduct = subscription.products && subscription.products.some(product =>
        (product.productName && product.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.variantName && product.variantName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      return matchesCustomer || matchesProduct;
    });
    setFilteredSubscriptions(filtered);
    setCurrentPage(1);
  }, [subscriptions, searchTerm]);

  const fetchSubscriptions = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllSubscriptions', storeNo);
      if (result.success) {
        setSubscriptions(result.subscriptions || []);
        setFilteredSubscriptions(result.subscriptions || []);
      } else {
        console.error('Failed to fetch subscriptions:', result.error);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  const indexOfLastSubscription = currentPage * rowsPerPage;
  const indexOfFirstSubscription = indexOfLastSubscription - rowsPerPage;
  const currentSubscriptions = filteredSubscriptions.slice(indexOfFirstSubscription, indexOfLastSubscription);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getStatusBadge = (status) => {
    const variants = {
      active: 'default',
      paused: 'secondary',
      cancelled: 'destructive'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getDaysDisplay = (days) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => dayNames[day]).join(', ');
  };

  const getTimeSlotDisplay = (timeSlot) => {
    const slots = {
      morning: '9:00 AM - 11:00 AM',
      evening: '6:00 PM - 8:00 PM'
    };
    return slots[timeSlot] || timeSlot;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Adeego Plus Subscriptions</CardTitle>
            <CardDescription className="text-left">
              Manage recurring delivery subscriptions for your customers.
            </CardDescription>
          </div>

          <div className="space-x-2">
            {canManageSubscriptions && (
              <AddSubscription fetchSubscriptions={fetchSubscriptions} />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Delivery Days</TableHead>
              <TableHead>Time Slot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentSubscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="h-8 w-8" />
                    <p>No subscriptions found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentSubscriptions.map((subscription) => (
                <TableRow key={subscription._id}>
                  <TableCell className="font-medium">{subscription.customerName}</TableCell>
                  <TableCell>{subscription.customerPhone}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {subscription.products && subscription.products.length > 0 ? (
                        subscription.products.map((product, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {product.productName} ({product.variantName})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">No products</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {getDaysDisplay(subscription.deliveryDays)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {getTimeSlotDisplay(subscription.timeSlot)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SubscriptionDetails subscription={subscription} />
                      {canManageSubscriptions && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <EditSubscription 
                            subscription={subscription} 
                            fetchSubscriptions={fetchSubscriptions} 
                          />
                          <DeleteSubscription 
                            subscription={subscription} 
                            fetchSubscriptions={fetchSubscriptions} 
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-muted-foreground">
            Showing <strong>{indexOfFirstSubscription + 1}-{Math.min(indexOfLastSubscription, filteredSubscriptions.length)}</strong> of{" "}
            <strong>{filteredSubscriptions.length}</strong> subscriptions
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage >= Math.ceil(filteredSubscriptions.length / rowsPerPage)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
