import React, { useState, useEffect } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import SelectedProductsTable from './SelectedProductsTable';
import ProductSearch from './ProductSearch';
import { v4 as uuidv4 } from 'uuid';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '../ui/use-toast';

// Import new components
import TotalAmountCard from './sale/TotalAmountCard';
import CustomerSelectionDialog from './sale/CustomerSelectionDialog';
import SaleDetailsDialog from './sale/SaleDetailsDialog';
import AlertDialogs from './sale/AlertDialogs';
import NewCustomerDialog from './sale/NewCustomerDialog';
import { Button } from '../ui/button';
import { ChevronDown, MapPin, MapPinHouse, PenLine, Search, User } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

function SaleCard() {
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [saleType, setSaleType] = useState('NEW SALE');
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState(null);
  const [fulfillmentType, setFulfillmentType] = useState('WALK-IN-CLIENT');
  const [customerResult, setCustomerResult] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showOutOfStockAlert, setShowOutOfStockAlert] = useState(false);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [showNoCreditAlert, setShowNoCreditAlert] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phoneNumber: '',
    address: '',
  });
  const [currentVariant, setCurrentVariant] = useState(null);
  const [custSearchDialog, setCustSearchDialog] = useState(false);
  const [storeNo, setStoreNo] = useState("");
  const [saleDetail, setSaleDetail] = useState(false);
  const [servedBy, setServedBy] = useState('');
  const [amountPaid, setAmountPaid] = useState(null);
  const [note, setNote] = useState('');
  const [change, setChange] = useState(null)
  const [discount, setDiscount] = useState(0)
  const store = useWsinfoStore((state) => state.wsinfo);
  const staff = useStaffStore((state) => state.staff)

  useEffect(() => {
    const handleKeyPress = (event) => {
    if (event.code === 'F10') {
      event.preventDefault(); // Prevent default F10 behavior
        setSaleDetail(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

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

  useEffect(() => {
    const storeNo = store.storeNo;
    if (storeNo) {
      setStoreNo(storeNo);
    }
  }, [store.storeNo]);

  useEffect(() => {
    if (staff.firstName) {
      setServedBy(staff.firstName + " " + staff.lastName)
    }
  }, [staff.firstName])

  useEffect(() => {
    const changeAmount = amountPaid - totalAmount
    setChange(changeAmount);
  }, [amountPaid])

  useEffect(() => {
    const fetchDefaultCustomer = async (storeNumber) => {
      console.log(store.storeNo)
      try {
        const result = await window.electronAPI.searchCustomers(storeNumber);
        if (result.success && result.customers.length > 0) {
          console.log(result.customers);
          setCustomer(result.customers[0]);
        }
        return null;
      } catch (error) {
        console.error('Error searching for customer:', error);
        return null;
      }
    };

    if (store.storeNo) {
      fetchDefaultCustomer(store.storeNo);
    }
  }, [store.storeNo]);

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleProductSelect = (variant) => {
    setCurrentVariant(variant);
    
    if (variant.stock < variant.conversionFactor) {
      setShowOutOfStockAlert(true);
      return;
    }

    const existingProduct = selectedProducts.find(p => p._id === variant._id);
    if (existingProduct) {
      const totalQuantity = (existingProduct.quantity) * existingProduct.conversionFactor;
      if (totalQuantity + variant.conversionFactor > variant.stock) {
        setShowOutOfStockAlert(true);
        return;
      }
    }

    if (variant.stock <= 5) {
      setShowLowStockAlert(true);
      return;
    }

    addProductToSelection(variant);
  };

  const addProductToSelection = (variant) => {
    setSelectedProducts(prevProducts => {
      const existingVariantIndex = prevProducts.findIndex(p => p._id === variant._id);
      if (existingVariantIndex !== -1) {
        return prevProducts.map((p, index) =>
          index === existingVariantIndex ? { ...p, quantity: p.quantity + 1 } : p
        );
      } else {
        // Store the original price when adding a new product
        return [...prevProducts, { ...variant, quantity: 1, originalPrice: variant.unitPrice }];
      }
    });
  };

  const handleProductRemove = (variantId) => {
    setSelectedProducts(prevProducts => {
      const removedProduct = prevProducts.find(p => p._id === variantId);
      if (removedProduct) {
        // Calculate discount to remove
        const productDiscount = (removedProduct.originalPrice - removedProduct.unitPrice) * removedProduct.quantity;
        setDiscount(prevDiscount => Math.max(0, prevDiscount - productDiscount));
      }
      return prevProducts.filter(variant => variant._id !== variantId);
    });
  };

  const handleQuantityChange = (variantId, newQuantity) => {
    setSelectedProducts(prevProducts =>
      prevProducts.map(variant => {
        if (variant._id === variantId) {
          if (newQuantity * variant.conversionFactor > variant.stock) {
            setShowOutOfStockAlert(true);
            return variant;
          }
          // Recalculate discount based on new quantity
          const oldDiscount = (variant.originalPrice - variant.unitPrice) * variant.quantity;
          const newDiscount = (variant.originalPrice - variant.unitPrice) * newQuantity;
          setDiscount(prevDiscount => prevDiscount - oldDiscount + newDiscount);
          return { ...variant, quantity: Math.max(1, newQuantity) };
        }
        return variant;
      })
    );
  };

  const handlePriceChange = (variantId, newPrice) => {
    setSelectedProducts(prevProducts =>
      prevProducts.map(variant => {
        if (variant._id === variantId) {
          // Calculate old and new discount amounts
          const oldDiscount = (variant.originalPrice - variant.unitPrice) * variant.quantity;
          const newDiscount = (variant.originalPrice - newPrice) * variant.quantity;
          
          // Update total discount
          setDiscount(prevDiscount => prevDiscount - oldDiscount + newDiscount);
          
          return { ...variant, unitPrice: Math.max(1, newPrice) };
        }
        return variant;
      })
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
    setCustSearchDialog(false);
  };

  const handleCustomerDataChange = (field, value) => {
    setNewCustomerData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateCustomer = async () => {
    const customerData = {
      _id: `${storeNo}:${uuidv4()}`,
      ...newCustomerData,
      balance: 0,
      credit: true,
      status: 'Active',
      storeNo: `${storeNo}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

  const validateSale = () => {
    if (!customer || !customer._id) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive"
      });
      return false;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product",
        variant: "destructive"
      });
      return false;
    }

    if (!amountPaid) {
      toast({
        title: "Error",
        description: "Please fill the Amount Paid",
        variant: "destructive"
      });
      return false;
    }

    if (paymentMethod === 'CREDIT' && !customer.credit) {
      setShowNoCreditAlert(true);
      return false;
    }

    return true;
  };

  const handleCreateSale = async () => {
    if (!validateSale()) {
      return;
    }

    const saleData = {
      _id: `${storeNo}:${uuidv4()}`,
      customerId: customer._id,
      items: selectedProducts.map(product => ({
        _id: `${storeNo}:${uuidv4()}`,
        productId: product.productId,
        name: `${product.productName} ${product.name}`,
        buyPrice: product.buyPrice * product.conversionFactor,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        subtotal: product.unitPrice * product.quantity,
        discount: parseInt((product.originalPrice - product.unitPrice) * product.quantity),
        conversionFactor: product.conversionFactor
      })),
      totalAmount: totalAmount,
      totalItems: selectedProducts.length,
      totalDiscount: discount,
      servedBy: `${servedBy}`,
      amountPaid: parseInt(amountPaid),
      change: change,
      note: `${note}`,
      paymentMethod: paymentMethod,
      saleType: saleType,
      fullfilmentType: fulfillmentType,
      confirmed: true,
      storeNo: `${storeNo}`,
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
        setSaleDetail(false);
        setDiscount(0);
        toast({
          title: "Success",
          description: "Sale created successfully!",
        });
      } else {
        console.error("Sale creation failed:", result.error);
        toast({
          title: "Error",
          description: "Failed to create sale. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating sale:", error);
      toast({
        title: "Error",
        description: "An error occurred while creating the sale.",
        variant: "destructive"
      });
    }
  };

  const handleLowStockContinue = () => {
    setShowLowStockAlert(false);
    addProductToSelection(currentVariant);
  };

  return (
    <div className="">
      <Card>
        <CardHeader className="flex flex-row justify-between space-y-0 pb-2">
          <div className="flex flex-col justify-around" >
            <div>
              <CardTitle className="text-3xl font-bold">New Sale</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">Create a new sales transaction</CardDescription>
            </div>
            <div>
              <Dialog>
                <DialogTrigger className="">Drafted Sale [5]</DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Drafted Sales</DialogTitle>
                    <DialogDescription>Drifted item list</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="flex flex-row justify-center items-center space-x-2" >
            <Card className="w-[280px] max-w-md">
              <CardContent className="space-y-3 p-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-select">Select Customer</Label>
                  <Button
                    id="customer-select"
                    variant="outline"
                    role="combobox"
                    aria-label="Select customer"
                    className="w-full justify-between text-left font-normal text-base py-6"
                    onClick={() => setCustSearchDialog(true)}
                  >
                    {customer ? (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{customer.name}</span>
                      </div>
                    ) : (
                      <span>Select customer</span>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </div>
                {customer && (
                  <div className="rounded-md bg-muted p-4 mb-2">
                    <div className="flex items-center space-x-2 text-base text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{customer.address}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <TotalAmountCard 
              totalAmount={totalAmount}
              onDraft={() => {}}
              onNext={() => setSaleDetail(true)}
            />
          </div>
          
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <Card className="col-span-3">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-xl font-bold">Selected Products [{selectedProducts.length}]</CardTitle>
                <ProductSearch handleProductSelect={handleProductSelect} />
              </CardHeader>
              <CardContent className="h-[400px] overflow-auto">
                <SelectedProductsTable 
                  selectedProducts={selectedProducts} 
                  handleProductRemove={handleProductRemove} 
                  handleQuantityChange={handleQuantityChange}
                  handlePriceChange={handlePriceChange}
                />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <CustomerSelectionDialog
        open={custSearchDialog}
        onOpenChange={setCustSearchDialog}
        name={name}
        onNameChange={handleNameChange}
        customerResult={customerResult}
        onCustomerSelect={handleCustomerSelect}
        selectedCustomer={customer}
      />

      <SaleDetailsDialog
        open={saleDetail}
        onOpenChange={setSaleDetail}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        saleType={saleType}
        setSaleType={setSaleType}
        fulfillmentType={fulfillmentType}
        setFulfillmentType={setFulfillmentType}
        onCompleteSale={handleCreateSale}
        amountPaid={amountPaid}
        setAmountPaid={setAmountPaid}
        note={note}
        setNote={setNote}
        servedBy={servedBy}
        change={change}
      />

      <AlertDialogs
        showOutOfStockAlert={showOutOfStockAlert}
        setShowOutOfStockAlert={setShowOutOfStockAlert}
        showLowStockAlert={showLowStockAlert}
        setShowLowStockAlert={setShowLowStockAlert}
        showNoCreditAlert={showNoCreditAlert}
        setShowNoCreditAlert={setShowNoCreditAlert}
        onLowStockContinue={handleLowStockContinue}
      />

      <NewCustomerDialog
        open={showNewCustomerDialog}
        onOpenChange={setShowNewCustomerDialog}
        customerData={newCustomerData}
        onCustomerDataChange={handleCustomerDataChange}
        onCreateCustomer={handleCreateCustomer}
      />
    </div>
  );
}

export default SaleCard;
