import React, { useState, useEffect, useRef } from 'react';
import { Search, User } from 'lucide-react';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import useWsinfoStore from '@/stores/wsinfo';

export default function CustomerSearch({ onSelectCustomer, selectedCustomer }) {
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
        fetchAllCustomers();
      }
    }
  }, [searchTerm, open]);

  useEffect(() => {
    setSelectedIndex(-1);
    setIsNavigatingList(false);
  }, [searchResults]);

  const fetchAllCustomers = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllCustomers', storeNo);
      if (result.success) {
        setSearchResults(result.customers || []);
      } else {
        console.error('Failed to fetch customers:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setSearchResults([]);
    }
  };

  const performSearch = async () => {
    try {
      const result = await window.electronAPI.realmOperation('searchCustomers', searchTerm, storeNo);
      if (result.success) {
        setSearchResults(result.customers || []);
      } else {
        console.error('Search failed:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error during search:', error);
      setSearchResults([]);
    }
  };

  const handleSelectCustomer = (customer) => {
    onSelectCustomer(customer);
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
      handleSelectCustomer(searchResults[selectedIndex]);
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
        className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-accent transition-colors"
      >
        {selectedCustomer ? (
          <div className="flex-1">
            <p className="font-medium">{selectedCustomer.name}</p>
            <p className="text-sm text-muted-foreground">{selectedCustomer.phoneNumber}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Search and select customer...</span>
          </div>
        )}
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>

      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Search Customers</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              id="search"
              placeholder="Search by name or phone number..."
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
              {searchResults.map((customer, index) => (
                <div
                  key={customer._id}
                  className={`flex items-center justify-between p-3 ${
                    selectedIndex === index ? 'bg-accent' : ''
                  } hover:bg-accent cursor-pointer rounded-md border m-1`}
                  onClick={() => handleSelectCustomer(customer)}
                  onMouseEnter={() => {
                    setSelectedIndex(index);
                    setIsNavigatingList(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{customer.name}</h4>
                      <p className="text-sm text-muted-foreground">{customer.phoneNumber}</p>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No customers found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
