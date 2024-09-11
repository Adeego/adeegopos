import React, { useState, useEffect } from 'react';
import AddProduct from './addProduct';
import ViewProduct from './viewProduct';

import { MoreHorizontal, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';

export default function ProductTable() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  // const [expandedProducts, setExpandedProducts] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [products, searchTerm]);

  const fetchProducts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllProducts');
      if (result.success) {
        setProducts(result.products);
        setFilteredProducts(result.products);
      } else {
        console.error('Failed to fetch products:', result.error);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // const toggleProductExpansion = (productId) => {
  //   setExpandedProducts(prev => ({
  //     ...prev,
  //     [productId]: !prev[productId]
  //   }));
  // };

  const indexOfLastProduct = currentPage * rowsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - rowsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-left">Products</CardTitle>
            <CardDescription className="text-left">
              Manage your products and view their sales performance.
            </CardDescription>
          </div>
          <AddProduct fetchProducts={fetchProducts} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search products..."
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
          <Table >
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="text-left">Name</TableHead>
                <TableHead className="text-left">Base Unit</TableHead>
                <TableHead className="hidden md:table-cell text-left">Buy Price</TableHead>
                <TableHead className="hidden md:table-cell text-left">Stock</TableHead>
                <TableHead className="hidden md:table-cell text-left">Status</TableHead>
                <TableHead className="hidden md:table-cell text-left">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProducts.map((product) => (
                <React.Fragment key={product._id}>
                  <TableRow className="text-base">
                    <TableCell className="text-left font-medium">{product.name}</TableCell>
                    <TableCell className="text-left">{product.baseUnit}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{product.buyPrice}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{product.stock}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{product.status}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">
                      <Link href={`/product/${product._id}`}>View</Link>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-base text-muted-foreground">
          Showing <strong>{indexOfFirstProduct + 1}-{Math.min(indexOfLastProduct, filteredProducts.length)}</strong> of <strong>{filteredProducts.length}</strong> products
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
            disabled={indexOfLastProduct >= filteredProducts.length}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}