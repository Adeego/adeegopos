import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from "lucide-react";

import DeleteCustomer from './deleteCustomer';
import useStaffStore from '@/stores/staffStore';
import useWsinfoStore from '@/stores/wsinfo';
import AddCustomer from './addCustomer';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { can } from '@/lib/rbac';

const creditFilters = [
  { value: 'all', label: 'All' },
  { value: 'owing', label: 'Owing' },
  { value: 'store-credit', label: 'Store Credit' },
  { value: 'settled', label: 'Settled' },
  { value: 'approved', label: 'Credit Approved' },
  { value: 'not-approved', label: 'Not Approved' },
];

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

function toAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(toAmount(value));
}

function getBalanceStatus(customer) {
  const balance = toAmount(customer.balance);

  if (balance < 0) {
    return {
      label: 'Owes',
      amount: Math.abs(balance),
      className: 'border-red-200 bg-red-50 text-red-700',
    };
  }

  if (balance > 0) {
    return {
      label: 'Store credit',
      amount: balance,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  return {
    label: 'Settled',
    amount: 0,
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  };
}

function matchesCreditFilter(customer, filter) {
  const balance = toAmount(customer.balance);

  switch (filter) {
    case 'owing':
      return balance < 0;
    case 'store-credit':
      return balance > 0;
    case 'settled':
      return balance === 0;
    case 'approved':
      return Boolean(customer.credit);
    case 'not-approved':
      return !customer.credit;
    default:
      return true;
  }
}

export default function CustomerTable() {
  const [customers, setCustomers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [creditFilter, setCreditFilter] = useState('all');
  const staff = useStaffStore((state) => state.staff);
  const store = useWsinfoStore((state) => state.wsinfo);
  const [storeNo, setStoreNo] = useState('');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  const canWriteCustomers = can(staff, 'customer:write');
  const canManageCredit = can(staff, 'customer:credit');

  const creditSummary = useMemo(() => {
    return customers.reduce((summary, customer) => {
      const balance = toAmount(customer.balance);
      if (balance < 0) {
        summary.totalOutstanding += Math.abs(balance);
        summary.debtorsCount += 1;
      }
      return summary;
    }, { totalOutstanding: 0, debtorsCount: 0 });
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch = !normalizedSearch ||
        String(customer.name || '').toLowerCase().includes(normalizedSearch) ||
        String(customer.phoneNumber || '').includes(normalizedSearch);

      return matchesSearch && matchesCreditFilter(customer, creditFilter);
    });
  }, [customers, creditFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [creditFilter, searchTerm, rowsPerPage]);

  const fetchCustomers = useCallback(async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllCustomers', storeNo);
      if (result.success) {
        setCustomers(result.customers || []);
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }, [storeNo]);

  useEffect(() => {
    if (storeNo) {
      fetchCustomers();
    }
  }, [fetchCustomers, storeNo]);

  const indexOfLastCustomer = currentPage * rowsPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - rowsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const firstVisibleRow = filteredCustomers.length === 0 ? 0 : indexOfFirstCustomer + 1;

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-left">Customers</CardTitle>
            <CardDescription className="text-left">
              Manage your customers and review credit exposure.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Outstanding</span>
              <div className="font-semibold text-red-700">{formatCurrency(creditSummary.totalOutstanding)}</div>
            </div>
            <div className="rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Customers owing</span>
              <div className="font-semibold">{creditSummary.debtorsCount}</div>
            </div>
            <div className="flex gap-2">
              {canManageCredit && (
                <Button asChild>
                  <Link href="/customers/manageCredit">Credit Management</Link>
                </Button>
              )}
              {canWriteCustomers && <AddCustomer fetchCustomers={fetchCustomers} />}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {creditFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={creditFilter === filter.value ? 'default' : 'outline'}
                  onClick={() => setCreditFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <Select value={rowsPerPage.toString()} onValueChange={(value) => setRowsPerPage(Number(value))}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((value) => (
                  <SelectItem key={value} value={value.toString()}>{value} rows</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              <TableHead className="hidden md:table-cell text-left"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentCustomers.length > 0 ? (
              currentCustomers.map((customer) => {
                const balanceStatus = getBalanceStatus(customer);

                return (
                  <TableRow key={customer._id}>
                    <TableCell className="text-left font-medium">{customer.name || 'Unknown customer'}</TableCell>
                    <TableCell className="text-left">{customer.phoneNumber || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{customer.address || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{formatCurrency(balanceStatus.amount)}</span>
                        <Badge variant="outline" className={`w-fit ${balanceStatus.className}`}>
                          {balanceStatus.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-left">
                      <Badge variant={customer.credit ? 'default' : 'secondary'}>
                        {customer.credit ? 'Approved' : 'Not approved'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-left">{customer.status || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">
                      <div className="flex flex-row gap-2">
                        <Button asChild size="sm">
                          <Link href={`/customers/${customer._id}`}>View</Link>
                        </Button>
                        {canWriteCustomers && (
                          <DeleteCustomer
                            customerId={customer._id}
                            customerName={customer.name}
                            fetchCustomers={fetchCustomers}
                            onDeleteSuccess={fetchCustomers}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No customers match the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{firstVisibleRow}-{Math.min(indexOfLastCustomer, filteredCustomers.length)}</strong> of <strong>{filteredCustomers.length}</strong> customers
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
