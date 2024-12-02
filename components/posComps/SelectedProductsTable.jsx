// components/posComps/SelectedProductsTable.jsx
import React, { useEffect, useRef } from 'react';
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

function SelectedProductsTable({ selectedProducts, handleProductRemove, handleQuantityChange, handlePriceChange }) {
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus on the quantity input of the last added product
    if (selectedProducts.length > 0) {
      const lastIndex = selectedProducts.length - 1;
      const quantityInput = inputRefs.current[lastIndex]?.quantity;
      if (quantityInput) {
        quantityInput.focus();
      }
    }
  }, [selectedProducts.length]);

  const handleKeyDown = (event, currentIndex, field) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const direction = event.key === 'ArrowUp' ? -1 : 1;
        const nextIndex = (currentIndex + direction + selectedProducts.length) % selectedProducts.length;
        inputRefs.current[nextIndex]?.[field]?.focus();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const nextField = field === 'quantity' ? 'price' : 'quantity';
        inputRefs.current[currentIndex]?.[nextField]?.focus();
      }
    }
  };

  return (
    <div>
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
        <TableBody className='text-base font-semibold'>
          {selectedProducts.map((variant, index) => {
            // Initialize refs for this row if they don't exist
            if (!inputRefs.current[index]) {
              inputRefs.current[index] = {};
            }

            return (
              <TableRow key={variant._id}>
                <TableCell>{variant.productName}</TableCell>
                <TableCell>{variant.name}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={variant.quantity}
                    onChange={(e) => handleQuantityChange(variant._id, parseInt(e.target.value, 10))}
                    className="w-20"
                    ref={(el) => inputRefs.current[index].quantity = el}
                    onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                    tabIndex={index * 2 + 1}
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    type="number"
                    value={variant.unitPrice}
                    onChange={(e) => handlePriceChange(variant._id, parseInt(e.target.value, 10))}
                    className="w-32"
                    ref={(el) => inputRefs.current[index].price = el}
                    onKeyDown={(e) => handleKeyDown(e, index, 'price')}
                    tabIndex={index * 2 + 2}
                  />
                </TableCell>
                <TableCell>KES {(variant.unitPrice * variant.quantity).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <button onClick={() => handleProductRemove(variant._id)}>
                    <Trash className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default SelectedProductsTable;
