import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

function ProductSearch({ handleProductSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    // Fetch all products when component mounts
    fetchAllProducts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      performSearch();
    } else {
      fetchAllProducts();
    }
  }, [searchTerm]);

  const fetchAllProducts = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllProducts');
      if (result.success) {
        setSearchResults(result.products);
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
      const result = await window.electronAPI.searchProducts(searchTerm);
      if (result.success) {
        setSearchResults(result.products);
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
    <div className="relative">
      <div className="relative ml-auto flex-1 md:grow-0">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search products..."
          className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          ref={inputRef}
        />
      </div>

      {/* Search Results */}
      {searchResults && searchResults.length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-300 bg-white shadow-lg max-h-60 overflow-y-auto">
          <ul className="divide-y divide-gray-200">
            {searchResults.map((product, index) => (
              <li
                key={product._id}
                className={`px-4 py-2 hover:bg-gray-100 cursor-pointer transition duration-200 ${
                  selectedIndex === index ? 'bg-gray-100' : ''
                }`}
                onClick={() => handleSelectProduct(product)} // Add click handler
              >
                <h4 className="font-semibold">{product.name}</h4>
                <p className="text-sm text-gray-600">{product.unit}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ProductSearch;