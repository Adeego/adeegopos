import React, { useState, useEffect } from 'react';
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreateALESheet from './createALE';
import { useRouter } from 'next/router';

// Predefined categories for each type
const CATEGORIES = {
  asset: [
    'Cash', 
    'Bank Account', 
    'Accounts Receivable', 
    'Inventory', 
    'Equipment', 
    'Real Estate', 
    'Investments'
  ],
  liability: [
    'Accounts Payable', 
    'Bank Loans', 
    'Credit Card Debt', 
    'Taxes Payable', 
    'Salaries Payable', 
    'Lease Obligations'
  ],
  equity: [
    'Owner\'s Capital', 
    'Retained Earnings', 
    'Common Stock', 
    'Preferred Stock', 
    'Additional Paid-in Capital'
  ]
}

export default function BalanceSheetTable() {
  const [balanceSheetEntries, setBalanceSheetEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchBalanceSheetEntries();
  }, []);

  useEffect(() => {
    const filtered = balanceSheetEntries.filter(entry =>
      (entry.category && entry.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.type && entry.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.description && entry.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredEntries(filtered);
    setCurrentPage(1);
  }, [balanceSheetEntries, searchTerm]);  

  const fetchBalanceSheetEntries = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllBalanceSheets');
      if (result.success) {
        setBalanceSheetEntries(result.balanceSheets);
        setFilteredEntries(result.balanceSheets);
      } else {
        console.error('Failed to fetch balance sheet entries:', result.error);
      }
    } catch (error) {
      console.error('Error fetching balance sheet entries:', error);
    }
  };

  const indexOfLastEntry = currentPage * rowsPerPage;
  const indexOfFirstEntry = indexOfLastEntry - rowsPerPage;
  const currentEntries = (filteredEntries || []).slice(indexOfFirstEntry, indexOfLastEntry);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const calculateTotalByType = (type) => {
    return filteredEntries
      .filter(entry => entry.type === type)
      .reduce((total, entry) => total + (entry.amount || 0), 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Balance Sheet Entries</CardTitle>
            <CardDescription className="text-left">
              Manage your financial position records
            </CardDescription>
          </div>
          <CreateALESheet onSubmit={fetchBalanceSheetEntries} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search entries by type, category, or description..."
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
                <TableHead className="text-left">Type</TableHead>
                <TableHead className="text-left">Category</TableHead>
                <TableHead className="text-left">Amount</TableHead>
                <TableHead className="text-left">Description</TableHead>
                <TableHead className="text-left">Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentEntries.map((entry) => (
                <TableRow key={entry._id} className="text-base">
                  <TableCell className="text-left font-medium capitalize">{entry.type}</TableCell>
                  <TableCell className="text-left">{entry.category}</TableCell>
                  <TableCell className="text-left">KES {entry.amount?.toLocaleString() || '0'}</TableCell>
                  <TableCell className="text-left">{entry.description || '-'}</TableCell>
                  <TableCell className="text-left">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => router.push(`/finance/balanceSheet/${entry._id}`)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-base text-muted-foreground">
          Showing <strong>{indexOfFirstEntry + 1}-{Math.min(indexOfLastEntry, filteredEntries.length)}</strong> of <strong>{filteredEntries.length}</strong> entries
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
            disabled={indexOfLastEntry >= filteredEntries.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
