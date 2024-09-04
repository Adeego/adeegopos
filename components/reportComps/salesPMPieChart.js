"use client"

import React, { useEffect, useState } from 'react'
import { TrendingUp } from "lucide-react"
import { Pie, PieChart } from "recharts"
import { ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function SalesPMPieChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const date1 = new Date('2023-01-01').toISOString();
        const date2 = new Date().toISOString();
        const result = await window.electronAPI.realmOperation('getSalesByPaymentMethod', date1, date2);
        
        if (result.success) {
          setData(result.data);
        } else {
          console.error('Error fetching payment method data', result.error);
        }
      } catch (error) {
        console.error('Error fetching sales data', error);
      }
    };

    fetchSalesData();
  }, []);

  const chartConfig = data.reduce((config, item) => {
    config[item.pmethod] = {
      label: item.pmethod,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Generate random color
    };
    return config;
  }, {});  

  const chartData = data.map((item, index) => ({
    pmethod: item.pmethod,
    totalAmount: item.totalAmount,
    sales: item.sales,
    fill: COLORS[index % COLORS.length],
  }));

  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <Card className="flex flex-col my-3 mr-2 ml-1">
      <CardHeader className="items-center pb-0">
        <CardTitle>Sales by Payment Method</CardTitle>
        <CardDescription>Current Year to Date</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[250px] w-full"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="sales" />}
            />
            <Pie
              data={chartData}
              dataKey="totalAmount"
              // name="pmethod"
              // label={({ formattedAmount }) => formattedAmount}
              // labelLine={false}
              // label={({ payload, ...props }) => {
              //   return (
              //     <text
              //       cx={props.cx}
              //       cy={props.cy}
              //       x={props.x}
              //       y={props.y}
              //       textAnchor={props.textAnchor}
              //       dominantBaseline={props.dominantBaseline}
              //       fill="hsla(var(--foreground))"
              //       className=' font-bold bg-slate-500'
              //     >
              //       {payload.sales}678768
              //     </text>
              //   )
              // }}
              nameKey="pmethod"
            />
            <ChartLegend content={<ChartLegendContent className="font-medium" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Total Sales: {totalSales} | KSH {totalAmount.toLocaleString()} <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing sales distribution by payment method
        </div>
      </CardFooter>
    </Card>
  )
}
