import React, { useState, useEffect, useRef } from 'react';
import { Search, Package } from 'lucide-react';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import useWsinfoStore from '@/stores/wsinfo';

export default function ProductVariantSearch({ onSelectProduct, buttonText = "Search product..." }) {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isNavigatingList, setIsNavigatingList] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (searchTerm) {
        performSearch();
      } else {
        fetchAllProducts();
      }
    }
  }, [searchTerm, open]);

  useEffect(() => {
    setSelectedIndex(-1);
    setIsNavigatingList(false);
  }, [searchResults]);

  const fetchAllProducts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllVariants', storeNo);
      if (result.success) {
        setSearchResults(result.products || []);
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
      const result = await window.electronAPI.searchVariants(searchTerm, storeNo);
      if (result.success) {
        setSearchResults(result.products || []);
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
    onSelectProduct(product);
    setSearchTerm('');
    setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-accent transition-colors text-muted-foreground"
      >
        <Package className="h-4 w-4" />
        <span>{buttonText}</span>
        <Search className="h-4 w-4 ml-auto" />
      </div>

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
              autoFocus
            />
          </div>
          {searchResults && searchResults.length > 0 ? (
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
                    <h4 className="font-semibold">
                      {product.productName} 
                      <span className="font-normal text-sm ml-1">({product.variantName})</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {`${((product.stock)/(product.conversionFactor)).toFixed(0)} remaining`}
                    </p>
                  </div>
                  <div className="">
                    <h4 className="font-bold text-xl">${product.unitPrice}</h4>
                  </div>
                </div>
              ))}
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No products found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
