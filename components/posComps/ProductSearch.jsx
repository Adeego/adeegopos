import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

function ProductSearch({ handleProductSelect }) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isNavigatingList, setIsNavigatingList] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchTerm) {
      performSearch();
    } else {
      fetchAllProducts();
    }
  }, [searchTerm]);

  useEffect(() => {
    // Reset navigation state when search results change
    setSelectedIndex(-1);
    setIsNavigatingList(false);
  }, [searchResults]);

  const fetchAllProducts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllVariants');
      if (result.success) {
        setSearchResults(result.products);
        console.log(result);
      } else {
        console.error('Failed to fetch products:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setSearchResults([]);
    }
  };

  const performSearch = async () => {
    try {
      const result = await window.electronAPI.searchVariants(searchTerm);
      if (result.success) {
        console.log(result);
        setSearchResults(result.products);
        console.log("Search successful")
      } else {
        console.error('Search failed:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error during search:', error);
      setSearchResults([]);
    }
  };

  const handleSelectProduct = (product) => {
    handleProductSelect(product);
    setSearchTerm(''); // Clear the search term after selecting
    setOpen(false); // Close the dialog after selection
  };

  const handleKeyDown = (event) => {
    if (!Array.isArray(searchResults) || searchResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isNavigatingList) {
        setIsNavigatingList(true);
        setSelectedIndex(0);
      } else if (selectedIndex < searchResults.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (isNavigatingList && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (isNavigatingList && selectedIndex === 0) {
        setIsNavigatingList(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
      }
    } else if (event.key === 'Enter' && isNavigatingList && selectedIndex >= 0) {
      event.preventDefault();
      handleSelectProduct(searchResults[selectedIndex]);
    } else if (event.key === 'Escape') {
      setIsNavigatingList(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.key === 'F3') {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Search className="mr-2 h-4 w-4" />
          Search Products
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Search Products</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              id="search"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="col-span-3"
              ref={inputRef}
            />
          </div>
          {searchResults && searchResults.length > 0 && (
            <ScrollArea className="h-[400px]">
              {searchResults.map((product, index) => (
                <div
                  key={product._id}
                  className={`flex items-center justify-between p-2 ${
                    selectedIndex === index ? 'bg-accent' : ''
                  } hover:bg-accent cursor-pointer rounded-md border m-1`}
                  onClick={() => handleSelectProduct(product)}
                  onMouseEnter={() => {
                    setSelectedIndex(index);
                    setIsNavigatingList(true);
                  }}
                >
                  <div>
                    <h4 className="font-semibold">{product.productName} <span className="font-normal text-sm">({product.variantName})</span></h4>
                    <p className="text-sm text-muted-foreground">{`${((product.stock)/(product.conversionFactor)).toFixed(0)} remaining`}</p>
                  </div>
                  <div className="">
                    <h4 className="font-bold text-xl">{product.unitPrice}</h4>
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductSearch;
