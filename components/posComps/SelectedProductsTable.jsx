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
      <Table className='overflow-y-auto'>
        <TableHeader className='text-base font-bold'>
          <TableRow>
            <TableHead>PRODUCT</TableHead>
            <TableHead>VARIANT</TableHead>
            <TableHead>QUANTITY</TableHead>
            <TableHead>UNIT PRICE</TableHead>
            <TableHead>TOTAL</TableHead>
            <TableHead className="text-right">REMOVE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className='text-base font-semibold' >
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
