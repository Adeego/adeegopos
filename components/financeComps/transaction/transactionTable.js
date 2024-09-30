import React, { useState, useEffect } from 'react';
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddTransaction from './addTransaction';
import { useRouter } from 'next/router';

export default function TransactionTable() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    const filtered = transactions.filter(t =>
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.amount && t.amount.toString().includes(searchTerm))
    );
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  }, [transactions, searchTerm]);  

  const fetchTransactions = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllTransactions');
      if (result.success) {
        setTransactions(result.transactions);
        setFilteredTransactions(result.transactions);
      } else {
        console.error('Failed to fetch transactions:', result.error);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const indexOfLastTransaction = currentPage * rowsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - rowsPerPage;
  const currentTransactions = (filteredTransactions || []).slice(indexOfFirstTransaction, indexOfLastTransaction);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Transactions</CardTitle>
            <CardDescription className="text-left">
              Manage your transactions.
            </CardDescription>
          </div>
          <AddTransaction fetchTransactions={fetchTransactions} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search transactions..."
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
              {currentTransactions.map((t) => (
                <TableRow key={t._id} className="text-base">
                  <TableCell className="text-left font-medium">{t.description}</TableCell>
                  <TableCell className="text-left">KES {t.amount}</TableCell>
                  <TableCell className="text-left">{new Date(t.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => router.push(`/finance/transaction/${t._id}`)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-base text-muted-foreground">
          Showing <strong>{indexOfFirstTransaction + 1}-{Math.min(indexOfLastTransaction, filteredTransactions.length)}</strong> of <strong>{filteredTransactions.length}</strong> transactions
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
            disabled={indexOfLastTransaction >= filteredTransactions.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}