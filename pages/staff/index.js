import React, { useState, useEffect } from 'react';
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddStaff from '@/components/staff/addStaff';
import { useRouter } from 'next/router';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    const filtered = staff.filter(s =>
      (s.firstName && s.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.phoneNumber && s.phoneNumber.includes(searchTerm))
    );
    setFilteredStaff(filtered);
    setCurrentPage(1);
  }, [staff, searchTerm]);  

  const fetchStaff = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllStaff');
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
              Manage your staff members.
            </CardDescription>
          </div>
          <AddStaff fetchStaff={fetchStaff} />
        </div>
      </CardHeader>
      <CardContent>
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
                <TableHead className="hidden md:table-cell text-left">Role</TableHead>
                <TableHead className="hidden md:table-cell text-left">Salary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentStaff.map((s) => (
                <TableRow key={s._id} className="text-base">
                  <TableCell className="text-left font-medium">{s.firstName} {s.lastName}</TableCell>
                  <TableCell className="text-left">{s.phoneNumber}</TableCell>
                  <TableCell className="hidden md:table-cell text-left">{s.role}</TableCell>
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
