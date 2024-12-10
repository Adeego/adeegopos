import React, { useState, useEffect } from 'react';
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddSupplier from '@/components/supplierComps/addSupplier';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Supplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (suppliers && suppliers.length > 0) {
      const filtered = suppliers.filter(s =>
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.phoneNumber && s.phoneNumber.includes(searchTerm))
      );
      setFilteredSuppliers(filtered);
      setCurrentPage(1);
    }
  }, [suppliers, searchTerm]);   

  const fetchSuppliers = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllSuppliers');
      if (result.success) {
        setSuppliers(result.suppliers);
        setFilteredSuppliers(result.suppliers);
      } else {
        console.error('Failed to fetch suppliers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const indexOfLastSupplier = currentPage * rowsPerPage;
  const indexOfFirstSupplier = indexOfLastSupplier - rowsPerPage;
  const currentSuppliers = (filteredSuppliers || []).slice(indexOfFirstSupplier, indexOfLastSupplier);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Supplier</CardTitle>
            <CardDescription className="text-left">
              Manage your suppliers.
            </CardDescription>
          </div>
          <div className="space-x-2">
            <Button><Link href={'/supplier/invoices'}>Invoices</Link></Button>
            <AddSupplier fetchSuppliers={fetchSuppliers} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search suppliers..."
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
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="text-left">Name</TableHead>
                <TableHead className="text-left">Phone Number</TableHead>
                <TableHead className="hidden md:table-cell text-left">Address</TableHead>
                <TableHead className="hidden md:table-cell text-left">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentSuppliers.map((s) => (
                <TableRow key={s._id} className="text-base">
                  <TableCell className="text-left font-medium">{s.name}</TableCell>
                  <TableCell className="text-left">{s.phoneNumber}</TableCell>
                  <TableCell className="hidden md:table-cell text-left">{s.address}</TableCell>
                  <TableCell className="hidden md:table-cell text-left">KES {s.balance}</TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => router.push(`/supplier/${s._id}`)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-base text-muted-foreground">
          Showing <strong>{indexOfFirstSupplier + 1}-{Math.min(indexOfLastSupplier, filteredSuppliers?.length ?? 0)}</strong> of <strong>{filteredSuppliers?.length ?? 0}</strong> suppliers
        </div>
        <div className="flex gap-2 text-base">
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
            disabled={indexOfLastSupplier >= (filteredSuppliers?.length ?? 0)}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
