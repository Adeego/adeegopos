
import { MoreHorizontal } from "lucide-react";

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

const customers = [
    {
      name: "John Doe",
      phoneNumber: "123-456-7890",
      address: "123 Maple Street",
      balance: "$400.00",
      credit: false,
      createdAt: "2024-01-15"
    },
    {
      name: "Jane Smith",
      phoneNumber: "987-654-3210",
      address: "456 Oak Avenue",
      balance: "$200.00",
      credit: true,
      createdAt: "2024-02-20"
    },
    {
      name: "Michael Johnson",
      phoneNumber: "555-123-4567",
      address: "789 Pine Road",
      balance: "$300.00",
      credit: false,
      createdAt: "2024-03-10"
    },
    {
      name: "Emily Davis",
      phoneNumber: "444-987-6543",
      address: "321 Birch Lane",
      balance: "$150.00",
      credit: false,
      createdAt: "2024-04-05"
    },
    {
      name: "William Brown",
      phoneNumber: "222-333-4444",
      address: "654 Cedar Street",
      balance: "$250.00",
      credit: false,
      createdAt: "2024-05-12"
    },
    {
      name: "Sophia Wilson",
      phoneNumber: "333-222-1111",
      address: "987 Spruce Avenue",
      balance: "$175.00",
      credit: false,
      createdAt: "2024-06-25"
    },
    {
      name: "James Martinez",
      phoneNumber: "111-555-6666",
      address: "432 Willow Boulevard",
      balance: "$400.00",
      credit: true,
      createdAt: "2024-07-03"
    },
    {
      name: "Olivia Garcia",
      phoneNumber: "666-777-8888",
      address: "876 Elm Street",
      balance: "$275.00",
      credit: true,
      createdAt: "2024-08-01"
    },
    {
      name: "Alexander Hernandez",
      phoneNumber: "999-000-1111",
      address: "543 Redwood Drive",
      balance: "$325.00",
      credit: false,
      createdAt: "2024-09-10"
    },
    {
      name: "Isabella Lee",
      phoneNumber: "888-999-0000",
      address: "210 Sequoia Way",
      balance: "$225.00",
      credit: true,
      createdAt: "2024-10-18"
    }
];
  

export default function Customers() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-left">Products</CardTitle>
        <CardDescription className="text-left">
          Manage your customers and view their contribution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Name</TableHead>
              <TableHead className="text-left">Phone Number</TableHead>
              <TableHead className="hidden md:table-cell text-left">Address</TableHead>
              <TableHead className="hidden md:table-cell text-left">Balance</TableHead>
              <TableHead className="hidden md:table-cell text-left">Credit</TableHead>
              <TableHead className="hidden md:table-cell text-left">Created at</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => (
              <TableRow key={index}>
                <TableCell className="text-left font-medium">{customer.name}</TableCell>
                <TableCell className="text-left">{customer.phoneNumber}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.address}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.balance}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.credit}</TableCell>
                <TableCell className="hidden md:table-cell text-left">{customer.createdAt}</TableCell>
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
                      <DropdownMenuItem>Remove</DropdownMenuItem>
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
          Showing <strong>1-5</strong> of <strong>{customers.length}</strong> products
        </div>
      </CardFooter>
    </Card>
  );
}
