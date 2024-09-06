import React, { useState, useEffect } from 'react';
import SelectedProductsTable from './SelectedProductsTable';
import ProductSearch from './ProductSearch';
import VariantSelection from './Variant';
import { v4 as uuidv4 } from 'uuid';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from "@/components/ui/separator";
import { Button } from '../ui/button';
import Link from 'next/link';

function SaleCard() {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState('CASH');
  const [saleType, setSaleType] = useState('NEW SALE');
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState([]);
  const [fulfillmentType, setFulfillmentType] = useState('WALK-IN-CLIENT');
  const [customerResult, setCustomerResult] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (name) {
        performCustomerSearch();
      } else {
        setCustomerResult([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [name]);

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleProductSelect = (product) => {
    if (product.variants.length === 1) {
      handleVariantSelect(product.variants[0]);
    } else {
      setSelectedProduct(product);
      setIsVariantDialogOpen(true);
    }
  };

  const handleVariantSelect = (variant) => {
    setSelectedProducts(prevProducts => {
      const existingVariantIndex = prevProducts.findIndex(p => p._id === variant._id);
      

      if (existingVariantIndex !== -1) {
        return prevProducts.map((p, index) => 
          index === existingVariantIndex ? { ...p, quantity: p.quantity + 1 } : p
        );
      } else {
        return [...prevProducts, { ...variant, quantity: 1 }];
      }
    });
    setIsVariantDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleProductRemove = (variantId) => {
    setSelectedProducts(prevProducts => 
      prevProducts.filter(variant => variant._id !== variantId)
    );
  };

  const handleQuantityChange = (variantId, newQuantity) => {
    setSelectedProducts(prevProducts =>
      prevProducts.map(variant =>
        variant._id === variantId
          ? { ...variant, quantity: Math.max(1, newQuantity) }
          : variant
      )
    );
  };

  const totalAmount = selectedProducts.reduce(
    (total, variant) => total + (variant.unitPrice * variant.quantity),
    0
  );

  const performCustomerSearch = async () => {
    try {
      const result = await window.electronAPI.searchCustomers(name);
      if (result.success) {
        setCustomerResult(result.customers);
      } else {
        console.error('Search failed:', result.error);
        setCustomerResult([]);
      }
    } catch (error) {
      console.error('Error during search:', error);
      setCustomerResult([]);
    }
  };

  const handleCustomerSelect = (chosenCustomer) => {
    setSelectedCustomer(customer);
    setCustomer(chosenCustomer);
    setCustomerResult([]);
    setName('')
  };

  const handleCreateSale = async () => {
    const saleData = {
      _id: uuidv4(),
      customerId: customer._id,
      items: selectedProducts.map(product => ({
        _id: uuidv4(),
        productVariantId: product._id, // Change this to store the variant ID instead of the whole object
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        subtotal: product.unitPrice * product.quantity,
        discount: 0,
      })),
      totalAmount: totalAmount,
      totalItems: selectedProducts.length,
      paymentMethod: paymentMethods,
      type: saleType,
      paid: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  
    try {
      const result = await window.electronAPI.realmOperation('createSale', saleData);
      if (result.success) {
        console.log("Sale created successfully:", result.sale);
        // Reset the state
        setSelectedProducts([]);
        setCustomer(null);
        setPaymentMethods('CASH');
        setSaleType('NEW SALE');
        // Show success message
        alert('Sale created successfully!');
      } else {
        console.error("Sale creation failed:", result.error);
        alert('Failed to create sale. Please try again.');
      }
    } catch (error) {
      console.error("Error creating sale:", error);
      alert('An error occurred while creating the sale.');
    }
  };  

  return (
    <div className="h-screen">
      <Card className="h-full">
        <CardHeader className="flex flex-row justify-between">
          <div>
            <CardTitle className="text-left">New Sale</CardTitle>
            <CardDescription className="text-left">Fill all the required fields</CardDescription>
          </div>
          <div>
            <Button >
              <Link href={'pos/salesHistory'}>Sales History</Link>
            </Button>
          </div>
          
        </CardHeader>
        <CardContent className="h-1/2">
          <div className="flex h-full">
            <ScrollArea className="w-2/3 rounded-md border">
              <SelectedProductsTable 
                selectedProducts={selectedProducts} 
                handleProductRemove={handleProductRemove} 
                handleQuantityChange={handleQuantityChange}
              />
            </ScrollArea>
            <Separator orientation="vertical" className="mx-3" />
            <div className="w-1/3">
              <ProductSearch handleProductSelect={handleProductSelect} />
            </div>
          </div>
          <Separator />
        </CardContent>
        <CardFooter>
          <div>
            <div className='flex justify-between'>
              <div>
                <Label>Total items</Label>
                <Input value={selectedProducts.length} readOnly />
                <Label>Payment Method</Label>
                <Select
                  name="payment"
                  value={paymentMethods}
                  onValueChange={(value) => setPaymentMethods(value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="MPESA">MPESA</SelectItem>
                    <SelectItem value="CREDIT">CREDIT</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Sale type</Label>
                <Select name="saleType" value={saleType} onValueChange={(value) => setSaleType(value)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select sale type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW SALE">NEW SALE</SelectItem>
                    <SelectItem value="RETURN SALE">RETURN SALE</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Fulfillment type</Label>
                <Select name="fulfillment" value={fulfillmentType} onValueChange={(value) => setFulfillmentType(value)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select fulfillment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALK-IN-CLIENT">WALK-IN-CLIENT</SelectItem>
                    <SelectItem value="DELIVERY">DELIVERY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer Search</Label>
                <Input 
                  placeholder="Enter customer name, number or address" 
                  type="text" value={name} 
                  onChange={handleNameChange} 
                />
                {customerResult && customerResult.length > 0 && (
                  <div className="mt-2">
                    {customerResult.map((chosenCustomer) => (
                      <div 
                        key={chosenCustomer._id} 
                        className="cursor-pointer hover:bg-gray-200 p-2"
                        onClick={() => handleCustomerSelect(chosenCustomer)}
                      >
                        {chosenCustomer.name} - {chosenCustomer.phone} - {chosenCustomer.address}
                      </div>
                    ))}
                  </div>
                )}
                {customer && (
                  <div className="mt-2">
                    <Label>Customer Name</Label>
                    <Input value={customer.name} readOnly />
                    <Label>Address</Label>
                    <Input value={customer.address} readOnly />
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Total Amount</Label>
              <Input value={totalAmount.toFixed(2)} readOnly />
            </div>
          </div>
          <div className="mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={handleCreateSale}
            >
              Create Sale
            </button>
          </div>
        </CardFooter>
      </Card>
      <VariantSelection
        isOpen={isVariantDialogOpen}
        onClose={() => setIsVariantDialogOpen(false)}
        product={selectedProduct}
        onVariantSelect={handleVariantSelect}
      />
    </div>
  );
}

export default SaleCard;
