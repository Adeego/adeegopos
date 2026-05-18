"use client"

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link'
import {
    ResponsiveContainer,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Area,
    AreaChart,
} from 'recharts'

export default function ProductSales({ saleItems = [] }) {
    const currencyFormatter = useMemo(() => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
        });
    }, []);

    const chartData = useMemo(() => {
        const groupedByDate = saleItems.reduce((acc, saleItem) => {
            if (!saleItem.createdAt) return acc;

            const dateKey = new Date(saleItem.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
            const sortKey = new Date(saleItem.createdAt).toISOString().split('T')[0];

            if (!acc[dateKey]) {
                acc[dateKey] = {
                    date: dateKey,
                    sortKey,
                    totalSales: 0,
                    totalQuantity: 0,
                    orders: 0,
                };
            }

            acc[dateKey].totalSales += Number(saleItem.subtotal || 0);
            acc[dateKey].totalQuantity += Number(saleItem.quantity || 0);
            acc[dateKey].orders += 1;
            return acc;
        }, {});

        return Object.values(groupedByDate).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [saleItems]);

    const sortedSaleItems = useMemo(() => {
        return [...saleItems].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
    }, [saleItems]);

    return (
        <Card className="shadow-lg overflow-hidden hover:shadow-xl border transition-shadow duration-300">
            <CardHeader className="bg-gray-50">
                <CardTitle className="text-2xl font-bold text-gray-800">Product Sales</CardTitle>
                <CardDescription className="text-sm text-gray-600">Product sales over time</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 p-6">
                <div className="h-[280px] rounded-md border border-gray-200 bg-white p-4">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="productSalesFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => `${Math.round(value)}`}
                                />
                                <Tooltip
                                    formatter={(value, name) => {
                                        if (name === 'totalSales') return currencyFormatter.format(Number(value || 0));
                                        if (name === 'totalQuantity') return `${Number(value || 0)} units`;
                                        return value;
                                    }}
                                    labelFormatter={(label) => `Date: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="totalSales"
                                    stroke="#2563eb"
                                    fill="url(#productSalesFill)"
                                    strokeWidth={2}
                                    name="Total Sales"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="totalQuantity"
                                    stroke="#16a34a"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    name="Quantity"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                            No product sales found for the last 30 days.
                        </div>
                    )}
                </div>

                <ScrollArea className="h-[420px] rounded-md border border-gray-200">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                                <TableHead className="font-semibold text-gray-700">Unit Price</TableHead>
                                <TableHead className="font-semibold text-gray-700">Quantity</TableHead>
                                <TableHead className="font-semibold text-gray-700">Subtotal</TableHead>
                                <TableHead className="font-semibold text-gray-700">Sale</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedSaleItems.map((saleItem) => (
                                <TableRow key={saleItem._id} className="hover:bg-gray-50">
                                    <TableCell>
                                        {saleItem.createdAt
                                            ? new Date(saleItem.createdAt).toLocaleDateString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })
                                            : '-'}
                                    </TableCell>
                                    <TableCell>{saleItem.name}</TableCell>
                                    <TableCell>{currencyFormatter.format(Number(saleItem.unitPrice || 0))}</TableCell>
                                    <TableCell>{saleItem.quantity}</TableCell>
                                    <TableCell>{currencyFormatter.format(Number(saleItem.subtotal || 0))}</TableCell>
                                    <TableCell>
                                        <Link
                                            href={`/pos/${saleItem.saleId}`}
                                            className="text-blue-600 underline underline-offset-4"
                                        >
                                            View
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
