"use client";
import ProductTable from "@/components/productComps/productTable";

import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
 } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Product() {
  return (
    <div>
      <ProductTable />
    </div>
  );
}


{/* <Card>
      <CardHeader>
        <CardTitle className="text-left">Products</CardTitle>
        <CardDescription className="text-left">
          Manage your products and view their sales performance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Name</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="hidden md:table-cell text-left">Price</TableHead>
              <TableHead className="hidden md:table-cell text-left">Total Sales</TableHead>
              <TableHead className="hidden md:table-cell text-left">Created at</TableHead>
              <TableHead className="hidden md:table-cell text-left">Margin</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, index) => (
              <TableRow key={index}>
                <TableCell className="text-left font-medium">{product.name}</TableCell>
                <TableCell className="text-left">
                  <Badge variant="outline">{product.status}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-left">{product.price}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{product.totalSales}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{product.createdAt}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{product.margin}</TableCell>
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
                      <DropdownMenuItem>View</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>1-5</strong> of <strong>{products.length}</strong> products
        </div>
      </CardFooter>
    </Card> */}