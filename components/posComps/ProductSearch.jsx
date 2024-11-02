import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

function ProductSearch({ handleProductSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);

  // useEffect(() => {
  //   // Fetch all products when component mounts
  //   fetchAllProducts();
  // }, []);

  useEffect(() => {
    if (searchTerm) {
      performSearch();
    } else {
      fetchAllProducts();
    }
  }, [searchTerm]);

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
        console.log("Search successifull")
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
    //setSearchResults([]); // Clear search results after selection
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'F3') {
        inputRef.current.focus();
      } else if (event.key === 'ArrowUp' && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (event.key === 'ArrowDown' && Array.isArray(searchResults) && selectedIndex < searchResults.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else if (event.key === 'Enter' && Array.isArray(searchResults) && selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelectProduct(searchResults[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIndex, searchResults]);

  return (
    <div className="p-2">
      <div className="flex flex-row items-center w-full rounded-lg border bg-background gap-1 h-12">
        <div className="flex justify-center items-center text-muted-foreground rounded-md border h-10 w-10 ml-1" >
          <Search size={26}  />
        </div>
        <Input
          type="search"
          placeholder="Search products..."
          className="w-[84%]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          ref={inputRef}
        />
      </div>

      {/* Search Results */}
      {searchResults && searchResults.length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-300 h-[330px] overflow-y-auto">
          <ul className="divide-y divide-gray-200">
            {searchResults.map((product, index) => (
              <li
                key={product._id}
                className={`px-4 py-2 hover:bg-gray-100 cursor-pointer transition duration-200 ${
                  selectedIndex === index ? 'bg-gray-100' : ''
                }`}
                onClick={() => handleSelectProduct(product)} // Add click handler
              >
                <h4 className="font-semibold">{product.productName} {product.variantName}</h4>
                <p className="text-sm text-gray-600">{product.unitPrice}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ProductSearch;