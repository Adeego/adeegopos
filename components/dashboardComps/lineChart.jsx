"use client"

import { useState, useEffect } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

export default function SalesLineChart() {
  const [hoveredHour, setHoveredHour] = useState(null)
  const [salesData, setSalesData] = useState([])

  useEffect(() => {
    fetchHourlySalesData();
  }, []);

  const fetchHourlySalesData = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getHourlySalesData');
      if (result.success) {
        setSalesData(result.data);
      } else {
        console.error('Failed to fetch hourly sales data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching hourly sales data:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(value);
  };

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle>Hourly Sales Chart</CardTitle>
        <CardDescription>Sales data from store opening (7AM) to closing (10PM)</CardDescription>
      </CardHeader>
      <CardContent >
        <ChartContainer
          config={{
            sales: {
              label: "Sales",
              color: "hsl(var(--chart-1))",
            },
          }}
          className="aspect-auto h-[300px] w-full"
        >
            <LineChart data={salesData}>
              <XAxis 
                dataKey="hour" 
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
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Time
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.hour}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Sales
                            </span>
                            <span className="font-bold">
                              {formatCurrency(payload[0].value)}
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
                dataKey="sales"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
                activeDot={{ r: 6, fill: "hsl(var(--chart-1))", stroke: "white", strokeWidth: 2 }}
                onMouseEnter={(data) => setHoveredHour(data.hour)}
                onMouseLeave={() => setHoveredHour(null)}
              />
            </LineChart>
        </ChartContainer>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {hoveredHour ? (
            <p>Hovered Hour: {hoveredHour}</p>
          ) : (
            <p>Hover over the chart to see detailed sales data for each hour</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
