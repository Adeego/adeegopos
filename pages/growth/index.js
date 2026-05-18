'use client'

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { TrendingUp, TrendingDown, Minus, Package, DollarSign, ShoppingCart, Percent, AlertTriangle } from 'lucide-react'
import useWsinfoStore from '@/stores/wsinfo'
import { Badge } from "@/components/ui/badge"

export default function GrowthAnalytics() {
  const [loading, setLoading] = useState(true)
  const [growthData, setGrowthData] = useState({
    dailySales: [],
    weeklySalesGrowth: [],
    weeklyProjection: null,
    averageOrderValue: [],
    weeklySales: [],
    topProducts: [],
    weeklyGrossMargin: [],
    weeklyFulfillmentType: [],
    weeklyStockoutRate: [],
    monthlyStockoutRate: []
  })
  
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  useEffect(() => {
    if (!storeNo) return
    fetchGrowthData()
  }, [storeNo])

  const fetchGrowthData = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.realmOperation('getGrowthMetrics', storeNo)
      if (result.success) {
        setGrowthData(result.data)
      } else {
        console.error('Failed to fetch growth data:', result.error)
      }
    } catch (error) {
      console.error('Error fetching growth data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const getTrendIcon = (trend) => {
    if (!trend) return <Minus className="h-4 w-4 text-gray-500" />
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-600" />
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  const getTrendColor = (trend) => {
    if (trend === 'up') return 'text-green-600'
    if (trend === 'down') return 'text-red-600'
    return 'text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading growth analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Growth Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Tracking period started from September 13, 2025 • Weeks: Saturday-Friday
          </p>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stockout Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              growthData.weeklyStockoutRate.length > 0 
                && growthData.weeklyStockoutRate[growthData.weeklyStockoutRate.length - 1].avgStockoutRate > 10
                ? 'text-red-600' : 'text-green-600'
            }`}>
              {growthData.weeklyStockoutRate.length > 0
                ? `${growthData.weeklyStockoutRate[growthData.weeklyStockoutRate.length - 1].avgStockoutRate}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {growthData.weeklyStockoutRate.length >= 2
                ? (() => {
                    const curr = growthData.weeklyStockoutRate[growthData.weeklyStockoutRate.length - 1].avgStockoutRate;
                    const prev = growthData.weeklyStockoutRate[growthData.weeklyStockoutRate.length - 2].avgStockoutRate;
                    const diff = Math.round((curr - prev) * 100) / 100;
                    return diff <= 0 ? `${Math.abs(diff)}% improvement` : `${diff}% increase`;
                  })()
                : 'Current week average'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Sales Trend</CardTitle>
            {growthData.weeklyProjection && getTrendIcon(growthData.weeklyProjection.trend)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthData.weeklySalesGrowth.length > 0 
                ? growthData.weeklySalesGrowth[growthData.weeklySalesGrowth.length - 1].numberOfSales 
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {growthData.weeklyProjection 
                ? `Projected: ${Math.round(growthData.weeklyProjection.projectedValue)} sales`
                : 'Calculating projection...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthData.averageOrderValue.length > 0
                ? formatCurrency(
                    growthData.averageOrderValue[growthData.averageOrderValue.length - 1].averageOrderValue
                  )
                : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">Current week average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{growthData.topProducts.length}</div>
            <p className="text-xs text-muted-foreground">Products tracking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthData.weeklyGrossMargin.length > 0
                ? `${growthData.weeklyGrossMargin[growthData.weeklyGrossMargin.length - 1].marginPercentage.toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">Current week margin</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Sales Line Graph with 7-Day Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Sales with 7-Day Projection</CardTitle>
          <CardDescription>
            Daily revenue trend for the current month with 1 week forecast
            <span className="ml-2 text-blue-600 font-medium">
              • Blue = Actual • Dashed = Projected
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              sales: {
                label: "Sales",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="aspect-auto h-[300px] w-full"
          >
            <LineChart data={growthData.dailySales}>
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tickFormatter={(value) => `KES ${value / 1000}k`}
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const isProjected = payload[0].payload.isProjected;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          {isProjected && (
                            <div className="text-xs font-semibold text-blue-600">
                              PROJECTED
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Date
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.date}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Revenue
                            </span>
                            <span className="font-bold">
                              {formatCurrency(payload[0].value)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Sales Count
                            </span>
                            <span className="font-bold">
                              {payload[0].payload.numberOfSales}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              {/* Actual sales line */}
              <Line
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.isProjected) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="hsl(var(--chart-1))"
                      stroke="white"
                      strokeWidth={1}
                    />
                  );
                }}
                strokeDasharray={(props) => {
                  // This won't work directly, we need a different approach
                  return "0";
                }}
                connectNulls
              />
              {/* Projected sales line */}
              <Line
                type="monotone"
                dataKey={(dataPoint) => dataPoint.isProjected ? dataPoint.sales : null}
                stroke="hsl(210, 100%, 50%)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload.isProjected) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="hsl(210, 100%, 50%)"
                      stroke="white"
                      strokeWidth={1}
                    />
                  );
                }}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Weekly Sales Growth */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Sales Growth</CardTitle>
          <CardDescription>
            Number of sales per week with growth percentage
            {growthData.weeklyProjection && (
              <span className={`ml-2 font-semibold ${getTrendColor(growthData.weeklyProjection.trend)}`}>
                {getTrendIcon(growthData.weeklyProjection.trend)} 
                Projected: {Math.round(growthData.weeklyProjection.projectedValue)} sales
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              numberOfSales: {
                label: "Number of Sales",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="aspect-auto h-[300px] w-full"
          >
            <LineChart data={growthData.weeklySalesGrowth}>
              <XAxis 
                dataKey="week" 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Week
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.week}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Sales
                            </span>
                            <span className="font-bold">
                              {payload[0].value}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Growth
                            </span>
                            <span className={`font-bold ${payload[0].payload.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {payload[0].payload.growth.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="numberOfSales"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--chart-2))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Average Order Value */}
      <Card>
        <CardHeader>
          <CardTitle>Average Order Value</CardTitle>
          <CardDescription>Weekly average order value trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              averageOrderValue: {
                label: "Average Order Value",
                color: "hsl(var(--chart-3))",
              },
            }}
            className="aspect-auto h-[300px] w-full"
          >
            <LineChart data={growthData.averageOrderValue}>
              <XAxis 
                dataKey="week" 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tickFormatter={(value) => `KES ${value}`}
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Week
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.week}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Avg Order Value
                            </span>
                            <span className="font-bold">
                              {formatCurrency(payload[0].value)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Total Sales
                            </span>
                            <span className="font-bold">
                              {payload[0].payload.numberOfSales}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="averageOrderValue"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--chart-3))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Weekly Sales Bar Graph */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Sales Revenue</CardTitle>
          <CardDescription>Total revenue per week</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              sales: {
                label: "Sales",
                color: "hsl(var(--chart-4))",
              },
            }}
            className="aspect-auto h-[300px] w-full"
          >
            <BarChart data={growthData.weeklySales}>
              <XAxis 
                dataKey="week" 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tickFormatter={(value) => `KES ${value / 1000}k`}
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Week
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.week}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Revenue
                            </span>
                            <span className="font-bold">
                              {formatCurrency(payload[0].value)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Sales Count
                            </span>
                            <span className="font-bold">
                              {payload[0].payload.numberOfSales}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar
                dataKey="sales"
                fill="hsl(var(--chart-4))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Weekly Gross Margin */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Gross Margin</CardTitle>
          <CardDescription>Average gross margin percentage per week</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              marginPercentage: {
                label: "Margin %",
                color: "hsl(var(--chart-5))",
              },
            }}
            className="aspect-auto h-[300px] w-full"
          >
            <LineChart data={growthData.weeklyGrossMargin}>
              <XAxis 
                dataKey="week" 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Week
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.week}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Margin %
                            </span>
                            <span className="font-bold">
                              {payload[0].value.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Gross Margin
                            </span>
                            <span className="font-bold">
                              {formatCurrency(payload[0].payload.grossMargin)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="marginPercentage"
                stroke="hsl(var(--chart-5))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--chart-5))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Delivery vs Walk-in Client Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery vs Walk-in Client Sales</CardTitle>
          <CardDescription>Weekly comparison of delivery and walk-in client sales since September 13, 2025</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              delivery: {
                label: "Delivery",
                color: "hsl(var(--chart-1))",
              },
              walkIn: {
                label: "Walk-in",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="aspect-auto h-[300px] w-full"
          >
            <BarChart data={growthData.weeklyFulfillmentType}>
              <XAxis 
                dataKey="week" 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Week
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.week}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Delivery Sales
                            </span>
                            <span className="font-bold" style={{ color: 'hsl(var(--chart-1))' }}>
                              {payload[0].payload.delivery} sales • {formatCurrency(payload[0].payload.deliveryRevenue)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Walk-in Sales
                            </span>
                            <span className="font-bold" style={{ color: 'hsl(var(--chart-2))' }}>
                              {payload[0].payload.walkIn} sales • {formatCurrency(payload[0].payload.walkInRevenue)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Total Sales
                            </span>
                            <span className="font-bold">
                              {payload[0].payload.delivery + payload[0].payload.walkIn} sales
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              <Bar
                dataKey="delivery"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                name="Delivery"
              />
              <Bar
                dataKey="walkIn"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
                name="Walk-in"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Weekly Stockout Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Stockout Rate</CardTitle>
          <CardDescription>
            Average percentage of tracked products out of stock per week
            {growthData.weeklyStockoutRate.length > 0 && (
              <span className="ml-2 font-semibold">
                • Latest: {growthData.weeklyStockoutRate[growthData.weeklyStockoutRate.length - 1].avgStockoutRate}%
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {growthData.weeklyStockoutRate.length > 0 ? (
            <ChartContainer
              config={{
                avgStockoutRate: {
                  label: "Stockout Rate %",
                  color: "hsl(0, 84%, 60%)",
                },
              }}
              className="aspect-auto h-[300px] w-full"
            >
              <LineChart data={growthData.weeklyStockoutRate}>
                <XAxis 
                  dataKey="week" 
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Week
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {payload[0].payload.week}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Avg Stockout Rate
                              </span>
                              <span className="font-bold text-red-600">
                                {payload[0].payload.avgStockoutRate}%
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Avg Critical Items
                              </span>
                              <span className="font-bold">
                                {payload[0].payload.avgCritical}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Avg Low Stock Items
                              </span>
                              <span className="font-bold">
                                {payload[0].payload.avgLow}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Snapshots
                              </span>
                              <span className="font-bold">
                                {payload[0].payload.count} days
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgStockoutRate"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(0, 84%, 60%)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No stockout data yet. Snapshots are recorded during daily stock checks.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Stockout Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Stockout Rate</CardTitle>
          <CardDescription>
            Average stockout rate per month — lower is better
          </CardDescription>
        </CardHeader>
        <CardContent>
          {growthData.monthlyStockoutRate.length > 0 ? (
            <ChartContainer
              config={{
                avgStockoutRate: {
                  label: "Stockout Rate %",
                  color: "hsl(25, 95%, 53%)",
                },
              }}
              className="aspect-auto h-[300px] w-full"
            >
              <BarChart data={growthData.monthlyStockoutRate}>
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Month
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {payload[0].payload.month}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Avg Stockout Rate
                              </span>
                              <span className="font-bold text-orange-600">
                                {payload[0].payload.avgStockoutRate}%
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Avg Critical / Low
                              </span>
                              <span className="font-bold">
                                {payload[0].payload.avgCritical} critical, {payload[0].payload.avgLow} low
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Data Points
                              </span>
                              <span className="font-bold">
                                {payload[0].payload.count} days
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="avgStockoutRate"
                  fill="hsl(25, 95%, 53%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No stockout data yet. Snapshots are recorded during daily stock checks.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 50 Performing Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top 50 Performing Products</CardTitle>
          <CardDescription>
            Best selling products in the past 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Sales Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {growthData.topProducts.length > 0 ? (
                  growthData.topProducts.map((product, index) => (
                    <TableRow key={product.productId}>
                      <TableCell className="font-medium">
                        <Badge variant={index < 3 ? "default" : "secondary"}>
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.productName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(product.quantitySold)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(product.numberOfSales)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No product data available yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
