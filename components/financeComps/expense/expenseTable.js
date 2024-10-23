import React, { useState, useEffect } from 'react';
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RecordExpense from './recordExpense';
import { useRouter } from 'next/router';

export default function ExpenseTable() {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    const filtered = expenses.filter(e =>
      (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.amount && e.amount.toString().includes(searchTerm))
    );
    setFilteredExpenses(filtered);
    setCurrentPage(1);
  }, [expenses, searchTerm]);  

  const fetchExpenses = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllExpenses');
      if (result.success) {
        setExpenses(result.expenses);
        setFilteredExpenses(result.expenses);
      } else {
        console.error('Failed to fetch expenses:', result.error);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const indexOfLastExpense = currentPage * rowsPerPage;
  const indexOfFirstExpense = indexOfLastExpense - rowsPerPage;
  const currentExpenses = (filteredExpenses || []).slice(indexOfFirstExpense, indexOfLastExpense);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Expenses</CardTitle>
            <CardDescription className="text-left">
              Manage your expenses.
            </CardDescription>
          </div>
          <RecordExpense fetchExpenses={fetchExpenses} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search expenses..."
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
                <TableHead className="text-left">Description</TableHead>
                <TableHead className="text-left">Amount</TableHead>
                <TableHead className="text-left">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentExpenses.map((e) => (
                <TableRow key={e._id} className="text-base">
                  <TableCell className="text-left font-medium">{e.description}</TableCell>
                  <TableCell className="text-left">KES {e.amount}</TableCell>
                  <TableCell className="text-left">{new Date(e.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => router.push(`/finance/expense/${e._id}`)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-base text-muted-foreground">
          Showing <strong>{indexOfFirstExpense + 1}-{Math.min(indexOfLastExpense, filteredExpenses.length)}</strong> of <strong>{filteredExpenses.length}</strong> expenses
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
            disabled={indexOfLastExpense >= filteredExpenses.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}