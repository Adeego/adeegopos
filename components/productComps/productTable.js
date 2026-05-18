import React, { useState, useEffect } from 'react';
import AddProduct from './addProduct';
import ViewProduct from './viewProduct';

import { MoreHorizontal, Search, ChevronDown, ChevronUp, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { useRouter } from 'next/router';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { can } from '@/lib/rbac';

export default function ProductTable() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const store = useWsinfoStore((state) => state.wsinfo);
  const staff = useStaffStore((state) => state.staff);
  const [storeNo, setStoreNo] = useState('');
  const canWriteProducts = can(staff, 'product:write');
  const canManageStock = can(staff, 'stock:manage');

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo);
    }
  }, [store]);

  useEffect(() => {
    if (storeNo) {
      fetchProducts();
    }
  }, [storeNo]);

  useEffect(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [products, searchTerm]);

  const fetchProducts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllProducts', storeNo);
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

  const toggleProductExpansion = (productId) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const indexOfLastProduct = currentPage * rowsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - rowsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getNearestExpiry = (product) => {
    const batches = product.batches || [];
    const batchesWithExpiry = batches.filter(b => b.expiryDate && b.quantity > 0);
    if (batchesWithExpiry.length === 0) return null;
    batchesWithExpiry.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    return batchesWithExpiry[0].expiryDate;
  };

  const getExpiryBadge = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const days = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (days <= 0) return { text: 'Expired', cls: 'bg-red-100 text-red-700' };
    if (days <= 7) return { text: `${days}d`, cls: 'bg-orange-100 text-orange-700' };
    if (days <= 30) return { text: `${days}d`, cls: 'bg-yellow-100 text-yellow-700' };
    return { text: `${days}d`, cls: 'bg-green-100 text-green-700' };
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(products, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = 'products.json';

    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

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
          <div className=''>
            {canWriteProducts && <Button className='mr-2' onClick={handleDownload}>Download</Button>}
            {canManageStock && <Button className='mr-2' ><Link href={`/product/restock`} >Restock</Link></Button>}
            {canWriteProducts && <AddProduct fetchProducts={fetchProducts} />}
          </div>
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
                <TableHead className="text-left">UoM</TableHead>
                <TableHead className="hidden md:table-cell text-left">Buy Price</TableHead>
                <TableHead className="hidden md:table-cell text-left">Stock</TableHead>
                <TableHead className="hidden md:table-cell text-left">Status</TableHead>
                <TableHead className="hidden md:table-cell text-left">Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProducts.map((product) => (
                <React.Fragment key={product._id}>
                  <TableRow className="text-sm">
                    <TableCell className="text-left font-medium">{product.name}</TableCell>
                    <TableCell className="text-left">{product.uom}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{product.buyPrice}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{product.stock}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">{product.status}</TableCell>
                    <TableCell className="hidden md:table-cell text-left">
                      {(() => {
                        const nearest = getNearestExpiry(product);
                        const badge = getExpiryBadge(nearest);
                        if (!badge) return <span className="text-muted-foreground text-xs">-</span>;
                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                            {badge.text === 'Expired' && <AlertTriangle className="mr-1 h-3 w-3" />}
                            {badge.text}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button className="h-6 w-12" onClick={() => router.push(`/product/${product._id}`)}>View</Button>
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
