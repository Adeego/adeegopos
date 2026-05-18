import React, { useState, useEffect, useCallback } from 'react';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import useDraftSalesStore from '@/stores/draftSales';
import SelectedProductsTable from './SelectedProductsTable';
import ProductSearch from './ProductSearch';
import Draft from './sale/draft';
import { v4 as uuidv4 } from 'uuid';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

// Import new components
import TotalAmountCard from './sale/TotalAmountCard';
import CustomerSelectionDialog from './sale/CustomerSelectionDialog';
import SaleDetailsDialog from './sale/SaleDetailsDialog';
import AlertDialogs from './sale/AlertDialogs';
import NewCustomerDialog from './sale/NewCustomerDialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, MapPin, MapPinHouse, PenLine, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SaleCard() {
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
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
  const [saleDetail, setSaleDetail] = useState(false);
  const [servedBy, setServedBy] = useState('');
  const [amountPaid, setAmountPaid] = useState(null);
  const [transactionCost, setTransactionCost] = useState(0);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [cashierAccounts, setCashierAccounts] = useState([]);
  const [cashierAccountsLoaded, setCashierAccountsLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [change, setChange] = useState(null)
  const [discount, setDiscount] = useState(0)
  const store = useWsinfoStore((state) => state.wsinfo);
  const storeNo = store.storeNo;
  const staff = useStaffStore((state) => state.staff)
  const addDraft = useDraftSalesStore(state => state.addDraft);

  const getDefaultPaymentMethod = useCallback((accounts = cashierAccounts) => {
    return accounts[0]?._id || 'CREDIT';
  }, [cashierAccounts]);

  const findCashierAccount = useCallback((accountId) => {
    return cashierAccounts.find((account) => account._id === accountId) || null;
  }, [cashierAccounts]);

  const buildPaymentEntry = useCallback((value, overrides = {}) => {
    if (value === 'CREDIT') {
      return {
        method: 'CREDIT',
        accountId: null,
        amount: overrides.amount ?? '',
        transactionCost: overrides.transactionCost ?? 0,
      };
    }

    const account = findCashierAccount(value);
    return {
      method: account?.name || overrides.method || '',
      accountId: account?._id || value || null,
      amount: overrides.amount ?? '',
      transactionCost: overrides.transactionCost ?? 0,
    };
  }, [findCashierAccount]);

  const buildDefaultPaymentBreakdown = useCallback((accounts = cashierAccounts) => {
    const first = accounts[0];
    const second = accounts[1];

    return [
      first
        ? { method: first.name, accountId: first._id, amount: '', transactionCost: 0 }
        : { method: 'CREDIT', accountId: null, amount: '', transactionCost: 0 },
      second
        ? { method: second.name, accountId: second._id, amount: '', transactionCost: 0 }
        : { method: 'CREDIT', accountId: null, amount: '', transactionCost: 0 },
    ];
  }, [cashierAccounts]);

  const fetchDefaultCustomer = useCallback(async (storeNumber) => {
    try {
      const result = await window.electronAPI.searchCustomers(storeNumber, storeNumber);
      if (result.success && result.customers.length > 0) {
        setCustomer(result.customers[0]);
      }
      return null;
    } catch (error) {
      console.error('Error searching for customer:', error);
      return null;
    }
  }, []);

  const fetchCashierAccounts = useCallback(async (storeNumber) => {
    try {
      const result = await window.electronAPI.realmOperation('getAllAccounts', { storeNo: storeNumber });
      if (result.success) {
        setCashierAccounts((result.accounts || []).filter((account) => account.accountType === 'Cashier'));
      } else {
        console.error('Failed to fetch cashier accounts:', result.error);
        setCashierAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching cashier accounts:', error);
      setCashierAccounts([]);
    } finally {
      setCashierAccountsLoaded(true);
    }
  }, []);

  const performCustomerSearch = useCallback(async () => {
    try {
      const result = await window.electronAPI.searchCustomers(name, storeNo);
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
  }, [name, storeNo]);

  useEffect(() => {
    const handleKeyPress = (event) => {
    if (event.code === 'F9') {
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
  }, [name, performCustomerSearch]);



  useEffect(() => {
    if (staff.firstName) {
      setServedBy(staff.firstName + " " + staff.lastName)
    }
  }, [staff.firstName, staff.lastName])

  const totalAmount = selectedProducts.reduce(
    (total, variant) => total + (variant.unitPrice * variant.quantity),
    0
  );

  useEffect(() => {
    const paidAmount = Number(amountPaid) || 0;
    const changeAmount = paidAmount - totalAmount
    setChange(changeAmount);
  }, [amountPaid, totalAmount])

  useEffect(() => {
    if (paymentMethod !== 'HYBRID') {
      return;
    }

    const paidAmount = paymentBreakdown.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const costAmount = paymentBreakdown.reduce((sum, payment) => sum + (Number(payment.transactionCost) || 0), 0);
    setAmountPaid(paidAmount ? String(paidAmount) : '');
    setTransactionCost(Number(costAmount.toFixed(2)));
  }, [paymentBreakdown, paymentMethod]);

  useEffect(() => {
    if (store.storeNo) {
      setCashierAccountsLoaded(false);
      fetchDefaultCustomer(store.storeNo);
      fetchCashierAccounts(store.storeNo);
    }
  }, [fetchCashierAccounts, fetchDefaultCustomer, store.storeNo]);

  useEffect(() => {
    if (!storeNo || !cashierAccountsLoaded) {
      return;
    }

    const isValidPaymentMethod = paymentMethod === 'CREDIT' ||
      paymentMethod === 'HYBRID' ||
      cashierAccounts.some((account) => account._id === paymentMethod);

    if (!isValidPaymentMethod) {
      setPaymentMethod(getDefaultPaymentMethod(cashierAccounts));
    }
  }, [cashierAccounts, cashierAccountsLoaded, getDefaultPaymentMethod, paymentMethod, storeNo]);

  useEffect(() => {
    if (paymentMethod !== 'HYBRID' || paymentBreakdown.length > 0) {
      return;
    }

    setPaymentBreakdown(buildDefaultPaymentBreakdown(cashierAccounts));
  }, [buildDefaultPaymentBreakdown, cashierAccounts, paymentBreakdown.length, paymentMethod]);

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

    if (customer.status === 'Banned') {
      toast({
        title: "Error",
        description: "This customer is banned and cannot make purchases",
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

    if (paymentMethod !== 'HYBRID' && paymentMethod !== 'CREDIT' && !findCashierAccount(paymentMethod)) {
      toast({
        title: "Error",
        description: "Please select a cashier account",
        variant: "destructive"
      });
      return false;
    }

    if (paymentMethod !== 'HYBRID' && !amountPaid) {
      toast({
        title: "Error",
        description: "Please fill the Amount Paid",
        variant: "destructive"
      });
      return false;
    }

    if (paymentMethod === 'HYBRID') {
      const validPayments = paymentBreakdown.map((payment) => ({
        ...payment,
        amount: Number(payment.amount) || 0,
        transactionCost: Number(payment.transactionCost) || 0,
      }));
      const methods = validPayments.map((payment) => payment.method);
      const paymentKeys = validPayments.map((payment) => payment.method === 'CREDIT' ? 'CREDIT' : payment.accountId);
      const splitTotal = validPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const splitCost = validPayments.reduce((sum, payment) => sum + payment.transactionCost, 0);

      if (validPayments.length !== 2 || validPayments.some((payment) => payment.amount <= 0)) {
        toast({
          title: "Error",
          description: "Hybrid payment requires two payment amounts",
          variant: "destructive"
        });
        return false;
      }

      if (validPayments.some((payment) => payment.method !== 'CREDIT' && !findCashierAccount(payment.accountId))) {
        toast({
          title: "Error",
          description: "Hybrid payment includes an invalid cashier account",
          variant: "destructive"
        });
        return false;
      }

      if (new Set(paymentKeys).size !== paymentKeys.length) {
        toast({
          title: "Error",
          description: "Choose two different payment methods for a hybrid sale",
          variant: "destructive"
        });
        return false;
      }

      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        toast({
          title: "Error",
          description: "Hybrid payment amounts must equal the sale total",
          variant: "destructive"
        });
        return false;
      }

      if (validPayments.some((payment) => payment.transactionCost < 0) || splitCost > totalAmount) {
        toast({
          title: "Error",
          description: "Hybrid transaction costs are invalid",
          variant: "destructive"
        });
        return false;
      }

      if (methods.includes('CREDIT') && !customer.credit) {
        setShowNoCreditAlert(true);
        return false;
      }
    }

    if (paymentMethod === 'CREDIT' && !customer.credit) {
      setShowNoCreditAlert(true);
      return false;
    }

    if ((Number(transactionCost) || 0) < 0) {
      toast({
        title: "Error",
        description: "Transaction cost cannot be negative",
        variant: "destructive"
      });
      return false;
    }

    if ((Number(transactionCost) || 0) > totalAmount) {
      toast({
        title: "Error",
        description: "Transaction cost cannot be greater than the sale total",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleClearSale = useCallback(() => {
    setSelectedProducts([]);
    setCustomer(null);
    setPaymentMethod(getDefaultPaymentMethod());
    setSaleType('NEW SALE');
    setDiscount(0);
    setAmountPaid(null);
    setTransactionCost(0);
    setPaymentBreakdown(buildDefaultPaymentBreakdown());
    setNote('');
    fetchDefaultCustomer(store.storeNo);
  }, [buildDefaultPaymentBreakdown, fetchDefaultCustomer, getDefaultPaymentMethod, store.storeNo]);

  const handleLoadDraft = useCallback((draft) => {
    // Check if there's an unfinished sale
    if (selectedProducts.length > 0) {
      // Save current sale as draft
      const currentDraft = {
        id: uuidv4(),
        selectedProducts,
        customer,
        paymentMethod,
        saleType,
        fulfillmentType,
        note,
        totalAmount,
        servedBy,
        transactionCost,
        paymentBreakdown
      };

      addDraft(currentDraft);
      
      toast({
        title: "Draft Saved",
        description: "Current sale has been saved as a draft"
      });
    }

    // Load the selected draft
    setSelectedProducts(draft.selectedProducts);
    setCustomer(draft.customer);
    setPaymentMethod(draft.paymentMethod);
    setSaleType(draft.saleType);
    setFulfillmentType(draft.fulfillmentType);
    setNote(draft.note);
    setTransactionCost(draft.transactionCost || 0);
    setPaymentBreakdown(draft.paymentBreakdown || buildDefaultPaymentBreakdown());
  }, [buildDefaultPaymentBreakdown, selectedProducts, customer, paymentMethod, saleType, fulfillmentType, note, totalAmount, transactionCost, paymentBreakdown, addDraft, servedBy, toast]);

  const handleCreateSale = async () => {
    if (!validateSale()) {
      return;
    }

    const selectedAccount = findCashierAccount(paymentMethod);
    const normalizedPaymentBreakdown = paymentMethod === 'HYBRID'
      ? paymentBreakdown.map((payment) => ({
          method: payment.method,
          accountId: payment.accountId || null,
          amount: Number(payment.amount) || 0,
          transactionCost: Number(payment.transactionCost) || 0,
        }))
      : [{
          ...buildPaymentEntry(paymentMethod, {
            amount: totalAmount,
            transactionCost: paymentMethod === 'CREDIT' ? 0 : Number(transactionCost) || 0,
          }),
          amount: Number(totalAmount) || 0,
          transactionCost: paymentMethod === 'CREDIT' ? 0 : Number(transactionCost) || 0,
        }];

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
      amountPaid: Number(amountPaid) || 0,
      transactionCost: paymentMethod === 'CREDIT' ? 0 : Number(transactionCost) || 0,
      change: change,
      note: `${note}`,
      paymentMethod: paymentMethod === 'HYBRID' ? 'HYBRID' : paymentMethod === 'CREDIT' ? 'CREDIT' : selectedAccount?.name,
      paymentBreakdown: normalizedPaymentBreakdown,
      saleType: saleType,
      fullfilmentType: fulfillmentType,
      paid: false,
      confirmed: true,
      storeNo: `${storeNo}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  
    try {
      const result = await window.electronAPI.realmOperation('createSale', saleData);
      if (result.success) {
        console.log("Sale created successfully:", result.sale);
        handleClearSale();
        setSaleDetail(false);
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
              <Draft onLoadDraft={handleLoadDraft} />
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
              selectedProducts={selectedProducts}
              customer={customer}
              paymentMethod={paymentMethod}
              saleType={saleType}
              fulfillmentType={fulfillmentType}
              servedBy={servedBy}
              note={note}
              transactionCost={transactionCost}
              paymentBreakdown={paymentBreakdown}
              onNext={() => setSaleDetail(true)}
              onClearSale={handleClearSale}
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
        transactionCost={transactionCost}
        setTransactionCost={setTransactionCost}
        paymentBreakdown={paymentBreakdown}
        setPaymentBreakdown={setPaymentBreakdown}
        note={note}
        setNote={setNote}
        servedBy={servedBy}
        change={change}
        totalAmount={totalAmount}
        cashierAccounts={cashierAccounts}
        buildPaymentEntry={buildPaymentEntry}
        buildDefaultPaymentBreakdown={buildDefaultPaymentBreakdown}
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
