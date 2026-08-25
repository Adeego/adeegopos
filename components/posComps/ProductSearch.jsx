import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import useWsinfoStore from '@/stores/wsinfo';

const RESULT_LIMIT = 50;
const CACHE_TTL_MS = 30 * 1000;
const productCacheByStore = new Map();

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getProductKey = (product) => product._id || `${product.productId || ''}:${product.variantName || product.name || ''}`;

const normalizeProduct = (product) => {
  const productName = product.productName || product.name || '';
  const variantName = product.variantName || product.name || productName;
  const conversionFactor = Number(product.conversionFactor) || 1;
  const searchableText = normalizeText([
    productName,
    variantName,
    product.name,
    product.barCode,
  ].filter(Boolean).join(' '));

  return {
    ...product,
    productName,
    variantName,
    conversionFactor,
    searchableText,
  };
};

const getRemainingStock = (product) => {
  const stock = Number(product.stock) || 0;
  return (stock / product.conversionFactor).toFixed(0);
};

const getCacheKey = (storeNo) => String(storeNo || '');

const hasFreshProducts = (cachedProducts) => {
  return cachedProducts && Date.now() - cachedProducts.loadedAt < CACHE_TTL_MS;
};

const fetchStoreProducts = (storeNo) => {
  const cacheKey = getCacheKey(storeNo);
  const cachedProducts = productCacheByStore.get(cacheKey);

  if (cachedProducts?.pending) {
    return cachedProducts.pending;
  }

  const pending = window.electronAPI.realmOperation('getAllVariants', storeNo)
    .then((result) => {
      if (!result.success) {
        throw new Error(result.error || 'Failed to load products');
      }

      const products = (result.products || []).map(normalizeProduct);
      productCacheByStore.set(cacheKey, {
        products,
        loadedAt: Date.now(),
      });

      return products;
    })
    .catch((error) => {
      const latestProducts = productCacheByStore.get(cacheKey);
      if (latestProducts?.pending === pending) {
        if (latestProducts.products) {
          productCacheByStore.set(cacheKey, {
            products: latestProducts.products,
            loadedAt: latestProducts.loadedAt || 0,
          });
        } else {
          productCacheByStore.delete(cacheKey);
        }
      }

      throw error;
    });

  productCacheByStore.set(cacheKey, {
    products: cachedProducts?.products,
    loadedAt: cachedProducts?.loadedAt || 0,
    pending,
  });

  return pending;
};

function ProductSearch({ handleProductSelect }) {
  const storeNo = useWsinfoStore((state) => state.wsinfo.storeNo);
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isNavigatingList, setIsNavigatingList] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!storeNo) return;

    const cachedProducts = productCacheByStore.get(getCacheKey(storeNo));
    if (hasFreshProducts(cachedProducts)) return;

    const preloadProducts = () => {
      fetchStoreProducts(storeNo).catch(() => {});
    };
    let timeoutId = null;
    let idleId = null;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(preloadProducts, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(preloadProducts, 750);
    }

    return () => {
      if (idleId && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [storeNo]);

  useEffect(() => {
    if (!open || !storeNo) return;

    let isCancelled = false;
    const cachedProducts = productCacheByStore.get(getCacheKey(storeNo));
    const hasCachedProducts = Array.isArray(cachedProducts?.products);

    if (hasCachedProducts) {
      setProducts(cachedProducts.products);
    }

    if (hasFreshProducts(cachedProducts)) {
      return () => {
        isCancelled = true;
      };
    }

    const fetchProducts = async () => {
      setLoadError('');
      setIsLoadingProducts(!hasCachedProducts);

      try {
        const nextProducts = await fetchStoreProducts(storeNo);
        if (isCancelled) return;

        setProducts(nextProducts);
        setLoadError('');
      } catch (error) {
        if (isCancelled) return;
        if (!hasCachedProducts) {
          setLoadError(error.message || 'Failed to load products');
          setProducts([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    fetchProducts();

    return () => {
      isCancelled = true;
    };
  }, [open, storeNo]);

  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: ['productName', 'variantName', 'name', 'barCode'],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [products]);

  const searchResults = useMemo(() => {
    if (!open) return [];

    const normalizedSearchTerm = normalizeText(searchTerm);
    if (!normalizedSearchTerm) {
      return products.slice(0, RESULT_LIMIT);
    }

    const exactMatches = products.filter((product) =>
      product.searchableText.includes(normalizedSearchTerm)
    );

    if (exactMatches.length >= RESULT_LIMIT || normalizedSearchTerm.length < 2) {
      return exactMatches.slice(0, RESULT_LIMIT);
    }

    const seenProductKeys = new Set(exactMatches.map(getProductKey));
    const fuzzyMatches = fuse
      .search(searchTerm)
      .map((result) => result.item)
      .filter((product) => {
        const key = getProductKey(product);
        if (seenProductKeys.has(key)) return false;
        seenProductKeys.add(key);
        return true;
      });

    return [...exactMatches, ...fuzzyMatches].slice(0, RESULT_LIMIT);
  }, [fuse, open, products, searchTerm]);

  useEffect(() => {
    setSelectedIndex(-1);
    setIsNavigatingList(false);
  }, [searchTerm, products]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchTerm('');
      setSelectedIndex(-1);
      setIsNavigatingList(false);
    }
  };

  const handleSelectProduct = (product) => {
    handleProductSelect(product);
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

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.key === 'F3') {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <Dialog modal={false} open={open} onOpenChange={handleOpenChange}>
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
          {isLoadingProducts && (
            <p className="text-sm text-muted-foreground px-8">Loading products...</p>
          )}
          {!isLoadingProducts && loadError && (
            <p className="text-sm text-destructive px-8">{loadError}</p>
          )}
          {!isLoadingProducts && !loadError && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground px-8">
              {searchTerm ? 'No products found.' : 'No active products found.'}
            </p>
          )}
          {searchResults.length > 0 && (
            <ScrollArea className="h-[400px]">
              {searchResults.map((product, index) => (
                <div
                  key={getProductKey(product)}
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
                    <p className="text-sm text-muted-foreground">{`${getRemainingStock(product)} remaining`}</p>
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
