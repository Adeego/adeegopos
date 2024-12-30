"use client"

import React, { useState, useEffect, useRef } from 'react'
import DatePickerWithPresets from '../generalComps/datePicker'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '../ui/button'
import Link from 'next/link'

export default function ProductSales({ saleItems }) {
    console.log(saleItems);

    return (
        <Card className="shadow-lg overflow-hidden hover:shadow-xl border transition-shadow duration-300">
            <CardHeader className="bg-gray-50">
                <CardTitle className="text-2xl font-bold text-gray-800">Product Sales</CardTitle>
                <CardDescription className="text-sm text-gray-600">Product sales over time</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 p-6">
                <ScrollArea className="h-[500px] rounded-md border border-gray-200">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                                <TableHead className="font-semibold text-gray-700">Unit Price</TableHead>
                                <TableHead className="font-semibold text-gray-700">Quantity</TableHead>
                                <TableHead className="font-semibold text-gray-700">Subtotal</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {saleItems.map((saleItem) => (
                                <TableRow key={saleItem._id} className="hover:bg-gray-50">
                                    <TableCell>{saleItem.name}</TableCell>
                                    <TableCell>{saleItem.unitPrice}</TableCell>
                                    <TableCell>{saleItem.quantity}</TableCell>
                                    <TableCell>{saleItem.subtotal}</TableCell>
                                    <TableCell>
                                        <Button >
                                            <Link href={`/pos/${saleItem.saleId}`} passHref >View</Link>
                                        </Button>
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
