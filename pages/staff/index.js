import React, { useState, useEffect } from 'react';
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddStaff from '@/components/staff/addStaff';
import { useRouter } from 'next/router';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { can, getRoleLabels, MODULE_OPTIONS } from '@/lib/rbac';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const store = useWsinfoStore((state) => state.wsinfo);
  const currentStaffUser = useStaffStore((state) => state.staff);
  const [storeNo, setStoreNo] = useState('');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (storeNo) {
      fetchStaff();
    }
  }, [storeNo]);

  useEffect(() => {
    const filtered = staff.filter(s =>
      (s.firstName && s.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.phoneNumber && s.phoneNumber.includes(searchTerm))
    );
    setFilteredStaff(filtered);
    setCurrentPage(1);
  }, [staff, searchTerm]);  

  const fetchStaff = async () => {
    if (!storeNo) return;
    try {
      const result = await window.electronAPI.realmOperation('getAllStaff', storeNo);
      if (result.success) {
        setStaff(result.staff);
        setFilteredStaff(result.staff);
        console.log(result.staff);
      } else {
        console.error('Failed to fetch staff:', result.error);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const indexOfLastStaff = currentPage * rowsPerPage;
  const indexOfFirstStaff = indexOfLastStaff - rowsPerPage;
  const currentStaff = filteredStaff.slice(indexOfFirstStaff, indexOfLastStaff);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Staff</CardTitle>
            <CardDescription className="text-left">
              {can(currentStaffUser, 'staff:manageRoles') ? 'Manage your staff members.' : 'View staff members.'}
            </CardDescription>
          </div>
          {can(currentStaffUser, 'staff:manageRoles') && <AddStaff fetchStaff={fetchStaff} />}
        </div>
      </CardHeader>
      <CardContent>
        {staff.some((member) => member.accessReviewRequired) && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Existing roles were converted to module access. Review the highlighted staff assignments and save each one to confirm them.
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search staff..."
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
                <TableHead className="text-left">Full Name</TableHead>
                <TableHead className="text-left">Phone</TableHead>
                <TableHead className="hidden md:table-cell text-left">Access preset</TableHead>
                <TableHead className="hidden lg:table-cell text-left">Modules</TableHead>
                <TableHead className="hidden md:table-cell text-left">Salary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentStaff.map((s) => (
                <TableRow key={s._id} className="text-base">
                  <TableCell className="text-left font-medium">
                    {s.firstName} {s.lastName}
                    {s.accessReviewRequired && <span className="ml-2 text-xs text-amber-700">Review</span>}
                  </TableCell>
                  <TableCell className="text-left">{s.phone}</TableCell>
                  <TableCell className="hidden md:table-cell text-left">{getRoleLabels(s).join(', ') || s.role}</TableCell>
                  <TableCell className="hidden lg:table-cell text-left">
                    {s.isOwner ? 'All 8' : MODULE_OPTIONS.filter((module) => s.moduleAccess?.[module.id]).length}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-left">KES {s.salary}</TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => router.push(`/staff/${s._id}`)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-base text-muted-foreground">
          Showing <strong>{indexOfFirstStaff + 1}-{Math.min(indexOfLastStaff, filteredStaff.length)}</strong> of <strong>{filteredStaff.length}</strong> staff members
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
            disabled={indexOfLastStaff >= filteredStaff.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
