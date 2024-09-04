"use client"

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function TotalSalesChart() {
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    totalRevenue: 0,
    grossProfit: 0
  });

  console.log(salesData)

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const startDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
        const endDate = new Date().toISOString();
        const result = await window.electronAPI.realmOperation('getTotalSalesRevenueAndProfit', startDate, endDate);
  
        if (result.success) {
          setSalesData({
            totalSales: result.data.totalSales || 0,
            totalRevenue: isFinite(result.data.totalRevenue) ? result.data.totalRevenue : 0,
            grossProfit: isFinite(result.data.grossProfit) ? result.data.grossProfit : 0
          });
        } else {
          console.error('Error fetching sales data:', result.error);
          setSalesData({ totalSales: 0, totalRevenue: 0, grossProfit: 0 });
        }
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setSalesData({ totalSales: 0, totalRevenue: 0, grossProfit: 0 });
      }
    };
  
    fetchSalesData();
  }, []);

  // Helper function to format numbers safely
  const formatNumber = (num) => {
    return isNaN(num) ? '0' : num.toFixed(2);
  };

  return (
    <div className='h-[100%] w-[250px] my-2 ml-1 '>
      <Card className="h-1/3 m-1">
        <CardHeader className="pb-2">
          <CardDescription>Revenue</CardDescription>
          <CardTitle className="text-4xl">${formatNumber(salesData.totalRevenue)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Total revenue for the last 30 days
          </div>
        </CardContent>
      </Card>
      <Card className="h-1/3 m-1">
        <CardHeader className="pb-2">
          <CardDescription>Sales</CardDescription>
          <CardTitle className="text-4xl">{salesData.totalSales}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Total number of sales for the last 30 days
          </div>
        </CardContent>
      </Card>
      <Card className="h-1/3 m-1">
        <CardHeader className="pb-2">
          <CardDescription>Gross Profit</CardDescription>
          <CardTitle className="text-4xl">${salesData.grossProfit}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Total gross profit for the last 30 days
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
