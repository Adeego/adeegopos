import React, { useState, useEffect } from 'react';
import DeleteCustomer from './deleteCustomer';
import EditCustomer from './editCustomer';
import AddCustomer from './addCustomer';
import Edit from './edit';

import { MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import Link from 'next/link';

export default function CustomerTable() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  // const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  console.log(customers);

  // // New customer state
  // const [newCustomer, setNewCustomer] = useState({
  //   _id: uuidv4(),
  //   name: '',
  //   phoneNumber: '',
  //   address: '',
  //   balance: '',
  //   credit: false,
  //   status: '',
  // });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(customer.phoneNumber).includes(searchTerm)
    );
    setFilteredCustomers(filtered);
    setCurrentPage(1);
  }, [customers, searchTerm]);

  const fetchCustomers = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllCustomers');
      if (result.success) {
        setCustomers(result.customers);
        setFilteredCustomers(result.customers);
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  // const handleInputChange = (e) => {
  //   const { name, value, type, checked } = e.target;
  //   setNewCustomer(prev => ({
  //     ...prev,
  //     [name]: type === 'checkbox' ? checked : value
  //   }));
  // };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   setIsAddingCustomer(true);
  //   try {
  //       const customerData = {
  //         ...newCustomer,
  //         balance: parseInt(newCustomer.balance)
  //       };
  //       const result = await window.electronAPI.realmOperation('createCustomer', customerData);
  //       if (result.success) {
  //           toast({
  //               title: "Success",
  //               description: "Customer created successfully!",
  //           });
  //           fetchCustomers(); // Refresh the customer list
  //           setNewCustomer({
  //               _id: uuidv4(),
  //               name: '',
  //               phoneNumber: '',
  //               address: '',
  //               balance: '',
  //               credit: false,
  //               status: ''
  //           });
  //       } else {
  //           throw new Error(result.error);
  //       }
  //   } catch (error) {
  //       console.error('Error creating customer:', error);
  //       toast({
  //           title: "Error",
  //           description: "Failed to create customer. Please try again.",
  //           variant: "destructive",
  //       });
  //   } finally {
  //       setIsAddingCustomer(false);
  //   }
  // };


  const indexOfLastCustomer = currentPage * rowsPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - rowsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Customers</CardTitle>
            <CardDescription className="text-left">
              Manage your customers and view their contribution.
            </CardDescription>
          </div>
          <AddCustomer fetchCustomers={fetchCustomers} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-4 py-2 w-64"
            />
          </div>
          <Select value={rowsPerPage.toString()} onValueChange={(value) => setRowsPerPage(Number(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>{value} rows</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Name</TableHead>
              <TableHead className="text-left">Phone Number</TableHead>
              <TableHead className="hidden md:table-cell text-left">Address</TableHead>
              <TableHead className="hidden md:table-cell text-left">Balance</TableHead>
              <TableHead className="hidden md:table-cell text-left">Credit</TableHead>
              <TableHead className="hidden md:table-cell text-left">Status</TableHead>
              <TableHead className="hidden md:table-cell text-left">View</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentCustomers.map((customer, index) => (
              <TableRow key={index}>
                <TableCell className="text-left font-medium">{customer.name}</TableCell>
                <TableCell className="text-left">{customer.phoneNumber}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.address}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.balance}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.credit ? 'Yes' : 'No'}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.status}</TableCell>
                <TableCell className="hidden md:table-cell text-left">
                  <Link href={`/customers/${customer._id}`}>View</Link>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Link href={`/customers/${customer._id}`}>View</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <EditCustomer
                          customer={customer}
                          onEditSuccess={fetchCustomers}
                        />
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <DeleteCustomer
                          customerId={customer._id}
                          customerName={customer.name}
                          onDeleteSuccess={fetchCustomers}
                        />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{indexOfFirstCustomer + 1}-{Math.min(indexOfLastCustomer, filteredCustomers.length)}</strong> of <strong>{filteredCustomers.length}</strong> customers
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
            disabled={indexOfLastCustomer >= filteredCustomers.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}