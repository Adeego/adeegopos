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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useToast } from '../ui/use-toast';
import { Search, User, UserPlus, CreditCard, DollarSign, Smartphone, ShoppingBag, RotateCcw, UserCheck, Truck, ShoppingCart } from 'lucide-react';

function SaleCard() {
  const { toast } = useToast()
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [saleType, setSaleType] = useState('NEW SALE');
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState([]);
  const [fulfillmentType, setFulfillmentType] = useState('WALK-IN-CLIENT');
  const [customerResult, setCustomerResult] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showOutOfStockAlert, setShowOutOfStockAlert] = useState(false);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phoneNumber: '',
    address: '',
  });
  const [currentVariant, setCurrentVariant] = useState(null);

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

  const handleProductSelect = (variant) => {
    setCurrentVariant(variant);
    if (variant.stock < 1) {
      setShowOutOfStockAlert(true);
      return;
    }

    if (variant.stock <= 5) {
      setShowLowStockAlert(true);
      return; // Add return here to prevent immediate product selection
    }

    addProductToSelection(variant);
  };

  // New function to handle adding product to selection
  const addProductToSelection = (variant) => {
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
    setSelectedCustomer(chosenCustomer);
    setCustomer(chosenCustomer);
    setCustomerResult([]);
    setName('');
  };

  const handleCreateCustomer = async () => {
    const customerData = {
      _id: `24091324:${uuidv4()}`,
      ...newCustomerData,
      balance: 0,
      credit: 0,
      status: 'Active',
      storeNo: '24091324',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const result = await window.electronAPI.realmOperation('createCustomer', customerData);
      if (result.success) {
        handleCustomerSelect(result.customer);
        setShowNewCustomerDialog(false);
        setNewCustomerData({ name: '', phoneNumber: '', address: '' });
      } else {
        console.error('Failed to create customer:', result.error);
      }
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const handleCreateSale = async () => {
    console.log(selectedProducts)
    const saleData = {
      _id: `24091324:${uuidv4()}`,
      customerId: customer._id,
      items: selectedProducts.map(product => ({
        _id: `24091324:${uuidv4()}`,
        productId: product.productId,
        name: `${product.productName} ${product.name}`,
        buyPrice: product.buyPrice * product.conversionFactor,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        subtotal: product.unitPrice * product.quantity,
        discount: 0,
        conversionFactor: product.conversionFactor
      })),
      totalAmount: totalAmount,
      totalItems: selectedProducts.length,
      paymentMethod: paymentMethod,
      saleType: saleType,
      fullfilmentType: fulfillmentType,
      confirmed: true,
      storeNo: '24091324',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  
    try {
      const result = await window.electronAPI.realmOperation('createSale', saleData);
      if (result.success) {
        console.log("Sale created successfully:", result.sale);
        setSelectedProducts([]);
        setCustomer(null);
        setPaymentMethod('CASH');
        setSaleType('NEW SALE');
        toast({
          title: "Success",
          description: "Sale created successfully!",
        })
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
    <div className="">
      <Card className="">
        <CardHeader className="flex flex-row justify-between">
          <div>
            <CardTitle className="text-left">New Sale</CardTitle>
            <CardDescription className="text-left">Fill all the required fields</CardDescription>
          </div>
          <div>
            <Button>
              <Link href={'pos/salesHistory'}>Sales History</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-1/2">
          <div className="flex h-full gap-3">
            <div className="w-2/3 rounded-md border h-[405px] overflow-y-auto">
              <SelectedProductsTable 
                selectedProducts={selectedProducts} 
                handleProductRemove={handleProductRemove} 
                handleQuantityChange={handleQuantityChange}
              />
            </div>
            {/* <Separator orientation="vertical" className="mx-3" /> */}
            <div className="w-1/3 rounded-md border">
              <ProductSearch handleProductSelect={handleProductSelect} />
            </div>
          </div>
          {/* <Separator /> */}
        </CardContent>
        <CardFooter>
            <div className='flex justify-between w-full gap-2'>
              <Card className="w-1/3">
                <CardHeader>
                  <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="payment">Payment Method</Label>
                    <Select name="payment" value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="payment">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">
                          <span className="flex items-center">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Cash
                          </span>
                        </SelectItem>
                        <SelectItem value="MPESA">
                          <span className="flex items-center">
                            <Smartphone className="mr-2 h-4 w-4" />
                            M-Pesa
                          </span>
                        </SelectItem>
                        <SelectItem value="CREDIT">
                          <span className="flex items-center">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Credit
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    </div>

                  <div className="space-y-2">
                    <Label>Sale Type</Label>
                    <RadioGroup value={saleType} onValueChange={setSaleType} className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="NEW SALE" id="new-sale" />
                        <Label htmlFor="new-sale" className="flex items-center">
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          New Sale
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="RETURN SALE" id="return-sale" />
                        <Label htmlFor="return-sale" className="flex items-center">
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Return Sale
                        </Label>
                      </div>
                    </RadioGroup>
                    </div>

                  <div className="space-y-2">
                    <Label>Fulfillment Type</Label>
                    <RadioGroup value={fulfillmentType} onValueChange={setFulfillmentType} className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="WALK-IN-CLIENT" id="walk-in" />
                        <Label htmlFor="walk-in" className="flex items-center">
                          <UserCheck className="mr-2 h-4 w-4" />
                          Walk-in Client
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="DELIVERY" id="delivery" />
                        <Label htmlFor="delivery" className="flex items-center">
                          <Truck className="mr-2 h-4 w-4" />
                          Delivery
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
              <Card className="w-1/3 max-w-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-2xl font-bold">Customer</CardTitle>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                    setShowNewCustomerDialog(true)
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="sr-only">Add new customer</span>
                  </Button>
                </CardHeader>
                <CardContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {customer ? customer.name : "Select customer"}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search customers..."
                          className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          value={name}
                          onChange={handleNameChange}
                        />
                      </div>
                      {customerResult && customerResult.length > 0 ? (
                        <ScrollArea className="h-[300px] w-full">
                          {customerResult.map((chosenCustomer) => (
                            <div
                              key={chosenCustomer._id}
                              className="cursor-pointer px-3 py-2 hover:bg-accent"
                              onClick={() => handleCustomerSelect(chosenCustomer)}
                            >
                              <div className="font-medium">{chosenCustomer.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {chosenCustomer.phone}
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No results found
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {customer && (
                    <div className="mt-4 space-y-4 rounded-lg bg-accent/50 p-4 transition-all">
                      <div className="flex items-center space-x-4">
                        <User className="h-12 w-12 rounded-full bg-background p-2" />
                        <div>
                          <h3 className="font-semibold">{customer.name}</h3>
                          <p className="text-sm text-muted-foreground">{customer.phone}</p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" value={customer.address} readOnly className="mt-1" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="w-1/3">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="total-amount" className="text-sm font-medium text-muted-foreground">
                      TOTAL AMOUNT
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="total-amount"
                        className="pl-10 text-3xl font-bold text-center h-16"
                        value={`KES ${totalAmount.toFixed(2)}`}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total-items" className="text-sm font-medium text-muted-foreground">
                      TOTAL ITEMS
                    </Label>
                    <div className="relative">
                      <ShoppingCart className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="total-items"
                        className="pl-10 text-xl font-semibold text-center h-12"
                        value={selectedProducts.length}
                        readOnly
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="px-6 py-0">
                  <Button
                    onClick={handleCreateSale}
                    className="w-full text-xl font-bold h-14"
                  >
                    SELL
                  </Button>
                </CardFooter>
              </Card>
            </div>
        </CardFooter>
      </Card>

      <AlertDialog open={showOutOfStockAlert} onOpenChange={setShowOutOfStockAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Out of Stock</AlertDialogTitle>
            <AlertDialogDescription>
              This item is out of stock. Please restock it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowOutOfStockAlert(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLowStockAlert} onOpenChange={setShowLowStockAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Low Stock Warning</AlertDialogTitle>
            <AlertDialogDescription>
              This item is running low on stock (5 or fewer items remaining).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowLowStockAlert(false);
              addProductToSelection(currentVariant); // Call addProductToSelection instead of handleProductSelect
            }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer record
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={newCustomerData.phoneNumber}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <Input
                id="address"
                value={newCustomerData.address}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, address: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCustomer}>Create Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SaleCard;
