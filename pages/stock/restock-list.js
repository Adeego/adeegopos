'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Trash2, Play, Sun, Moon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import useWsinfoStore from "@/stores/wsinfo"

const CATEGORIES = ['Primary', 'Secondary', 'Perishable', 'Drinks'];

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)
}

export default function RestockListPage() {
  const [restockLists, setRestockLists] = useState({
    Primary: [],
    Secondary: [],
    Perishable: [],
    Drinks: []
  });
  const [loading, setLoading] = useState(true);
  const [runningCalculation, setRunningCalculation] = useState(null);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const { toast } = useToast();

  const fetchRestockLists = useCallback(async () => {
    if (!wsinfo?.storeNo) return;
    
    setLoading(true);
    try {
      const result = await window.electronAPI.restock('getRestockList', wsinfo.storeNo);
      if (result.success) {
        setRestockLists({
          Primary: result.items.Primary || [],
          Secondary: result.items.Secondary || [],
          Perishable: result.items.Perishable || [],
          Drinks: result.items.Drinks || []
        });
      }
    } catch (error) {
      console.error('Error fetching restock lists:', error);
      toast({
        title: "Error",
        description: "Failed to fetch restock lists",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast, wsinfo?.storeNo]);

  const checkLowStock = async () => {
    if (!wsinfo?.storeNo) return;
    
    try {
      const result = await window.electronAPI.restock('checkLowStock', wsinfo.storeNo);
      if (result.success) {
        toast({
          title: "Low Stock Check Complete",
          description: `Added ${result.addedCount} products to restock lists`,
        });
        fetchRestockLists();
      }
    } catch (error) {
      console.error('Error checking low stock:', error);
      toast({
        title: "Error",
        description: "Failed to check low stock products",
        variant: "destructive"
      });
    }
  };

  const removeFromList = async (category, productId) => {
    if (!wsinfo?.storeNo) return;
    
    try {
      const result = await window.electronAPI.restock('removeFromRestockList', wsinfo.storeNo, category, productId);
      if (result.success) {
        setRestockLists(prev => ({
          ...prev,
          [category]: prev[category].filter(p => p.productId !== productId)
        }));
        toast({
          title: "Removed",
          description: "Product removed from restock list",
        });
      }
    } catch (error) {
      console.error('Error removing from restock list:', error);
      toast({
        title: "Error",
        description: "Failed to remove product",
        variant: "destructive"
      });
    }
  };

  const clearCategory = async (category) => {
    if (!wsinfo?.storeNo) return;
    
    try {
      const result = await window.electronAPI.restock('clearRestockList', wsinfo.storeNo, [category]);
      if (result.success) {
        setRestockLists(prev => ({
          ...prev,
          [category]: []
        }));
        toast({
          title: "Cleared",
          description: `${category} restock list cleared`,
        });
      }
    } catch (error) {
      console.error('Error clearing restock list:', error);
      toast({
        title: "Error",
        description: "Failed to clear restock list",
        variant: "destructive"
      });
    }
  };

  const runCalculation = async (scheduleType) => {
    if (!wsinfo?.storeNo) return;
    
    setRunningCalculation(scheduleType);
    try {
      const task = scheduleType === 'morning' ? 'runMorningRestock' : 'runEveningRestock';
      const result = await window.electronAPI.restock(task, wsinfo.storeNo);
      
      if (result.success) {
        toast({
          title: "Calculation Complete",
          description: `${scheduleType === 'morning' ? 'Morning' : 'Evening'} restock calculation completed. ${result.processedCount} products processed.`,
        });
        fetchRestockLists();
      } else {
        toast({
          title: "No Products",
          description: result.message || "No products to process",
        });
      }
    } catch (error) {
      console.error('Error running calculation:', error);
      toast({
        title: "Error",
        description: "Failed to run restock calculation",
        variant: "destructive"
      });
    } finally {
      setRunningCalculation(null);
    }
  };

  useEffect(() => {
    fetchRestockLists();
  }, [fetchRestockLists]);

  const getTotalCount = () => {
    return Object.values(restockLists).reduce((sum, list) => sum + list.length, 0);
  };

  const getCategoryBadgeVariant = (category) => {
    switch (category) {
      case 'Primary': return 'default';
      case 'Secondary': return 'secondary';
      case 'Perishable': return 'destructive';
      case 'Drinks': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Restock List</h1>
          <p className="text-muted-foreground">
            Products pending restock calculation ({getTotalCount()} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkLowStock}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Low Stock
          </Button>
          <Button 
            variant="outline" 
            onClick={() => runCalculation('morning')}
            disabled={runningCalculation !== null}
          >
            {runningCalculation === 'morning' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sun className="h-4 w-4 mr-2" />
            )}
            Run Morning
          </Button>
          <Button 
            variant="outline" 
            onClick={() => runCalculation('evening')}
            disabled={runningCalculation !== null}
          >
            {runningCalculation === 'evening' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Moon className="h-4 w-4 mr-2" />
            )}
            Run Evening
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchRestockLists}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Categorized Restock Lists</CardTitle>
          <CardDescription>
            Morning (6 AM): Primary, Secondary, Drinks | Evening (6 PM): Perishable
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="Primary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {CATEGORIES.map(category => (
                  <TabsTrigger key={category} value={category} className="relative">
                    {category}
                    {restockLists[category].length > 0 && (
                      <Badge 
                        variant={getCategoryBadgeVariant(category)} 
                        className="ml-2 h-5 px-1.5"
                      >
                        {restockLists[category].length}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CATEGORIES.map(category => (
                <TabsContent key={category} value={category}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-muted-foreground">
                      {category === 'Perishable' 
                        ? 'Calculated daily at 6:00 PM' 
                        : 'Calculated daily at 6:00 AM'}
                    </div>
                    {restockLists[category].length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => clearCategory(category)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>

                  {restockLists[category].length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No products in {category} restock list
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Stock</TableHead>
                          <TableHead className="text-right">Threshold</TableHead>
                          <TableHead>AI Recommendation</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead className="text-right">Added</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restockLists[category].map((product) => (
                          <TableRow key={product.productId}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={product.currentStock <= 0 ? 'destructive' : 'outline'}>
                                {product.currentStock}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{product.restockThreshold}</TableCell>
                            <TableCell>
                              {product.source === 'stock-ai' ? (
                                <div className="space-y-1">
                                  <Badge variant={product.riskLevel === 'Critical' ? 'destructive' : product.riskLevel === 'High' ? 'warning' : 'secondary'}>
                                    {product.riskLevel || 'Stock AI'}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    Buy {product.recommendedPurchaseQty || product.recommendedQty || 0} {product.recommendedUnitName || 'units'} ({formatCurrency(product.estimatedCost)})
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {product.supplierRecommendation?.supplierName || '-'}
                              </div>
                              {product.supplierRecommendation?.unitCost > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(product.supplierRecommendation.unitCost)} / base unit
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {new Date(product.addedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromList(category, product.productId)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
