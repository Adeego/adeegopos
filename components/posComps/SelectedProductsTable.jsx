// components/posComps/SelectedProductsTable.jsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Trash } from 'lucide-react';
import { Input } from '../ui/input';

function SelectedProductsTable({ selectedProducts, handleProductRemove, handleQuantityChange }) {
  return (
    <div >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead className="text-right">Remove</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {selectedProducts.map((variant) => (
            <TableRow key={variant._id}>
              <TableCell>{variant.productName}</TableCell>
              <TableCell>{variant.name}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={variant.quantity}
                  onChange={(e) => handleQuantityChange(variant._id, parseInt(e.target.value, 10))}
                  className="w-16"
                />
              </TableCell>
              <TableCell>{variant.unitPrice.toFixed(2)}</TableCell>
              <TableCell>KES {(variant.unitPrice * variant.quantity).toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <button onClick={() => handleProductRemove(variant._id)}>
                  <Trash className="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default SelectedProductsTable;
