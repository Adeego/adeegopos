import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import useWsinfoStore from '@/stores/wsinfo'

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: decimals,
  }).format(Number(value) || 0)
}

function formatDateTime(value) {
  if (!value) return 'Not generated'
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDays(value) {
  if (Number(value) >= 999) return 'Enough'
  return `${formatNumber(value, 1)}d`
}

function getRiskBadge(riskLevel) {
  if (riskLevel === 'Critical') return <Badge variant="destructive">Critical</Badge>
  if (riskLevel === 'High') return <Badge variant="warning">High</Badge>
  return <Badge variant="secondary">Watch</Badge>
}

function getStatusBadge(item) {
  if (item.status === 'approved') {
    return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
  }
  if (item.status === 'dismissed') {
    return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Dismissed</Badge>
  }
  return <Badge variant="outline">Pending</Badge>
}

function EmptyPanel({ icon: Icon = PackageCheck, title }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center rounded-md border text-center text-muted-foreground">
      <Icon className="mb-3 h-9 w-9 text-emerald-600" />
      <p className="font-medium text-neutral-800">{title}</p>
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, tone = 'text-neutral-900' }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${tone}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function RecommendationTable({ items, onApprove, onDismiss, busyItem, showActions = true }) {
  if (!items || items.length === 0) {
    return <EmptyPanel title="No items in this list." />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Buy</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.productId}>
              <TableCell className="min-w-[180px]">
                <div className="font-medium">{item.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{item.category}</Badge>
                  {item.priorityTier === 'fast_small_item' && <Badge variant="secondary">Fast small item</Badge>}
                </div>
              </TableCell>
              <TableCell>{getRiskBadge(item.riskLevel)}</TableCell>
              <TableCell className="text-right">{formatNumber(item.currentStock, 1)}</TableCell>
              <TableCell className="text-right">{formatDays(item.daysToStockout ?? item.daysOfStock)}</TableCell>
              <TableCell className="text-right font-semibold">
                {formatNumber(item.recommendedPurchaseQty || item.recommendedQty, 1)} {item.recommendedUnitName || 'units'}
              </TableCell>
              <TableCell className="min-w-[170px]">
                <div className="font-medium">{item.supplierRecommendation?.supplierName || 'No supplier history'}</div>
                <div className="text-xs text-muted-foreground">
                  {item.supplierRecommendation?.source === 'best_recent_invoice_price'
                    ? 'Best recent price'
                    : item.supplierRecommendation?.source === 'latest_invoice_price'
                      ? 'Latest invoice price'
                      : 'Current buy price'}
                </div>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(item.estimatedCost)}</TableCell>
              <TableCell className="min-w-[260px] text-sm text-muted-foreground">{item.reason}</TableCell>
              <TableCell>{getStatusBadge(item)}</TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => onApprove(item)}
                      disabled={item.status !== 'pending' || busyItem === item.productId}
                    >
                      {busyItem === item.productId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDismiss(item)}
                      disabled={item.status !== 'pending' || busyItem === item.productId}
                    >
                      Dismiss
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CashProtectionTable({ items }) {
  if (!items || items.length === 0) {
    return <EmptyPanel icon={Wallet} title="No cash protection flags right now." />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead className="text-right">Stock value</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Revenue 30d</TableHead>
            <TableHead className="text-right">Avg margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.productId}>
              <TableCell className="min-w-[180px]">
                <div className="font-medium">{item.name}</div>
                <Badge variant="outline" className="mt-1">{item.category}</Badge>
              </TableCell>
              <TableCell className="min-w-[220px]">
                <div className="flex flex-wrap gap-1">
                  {(item.cashFlags || []).map((flag) => <Badge key={flag} variant="secondary">{flag}</Badge>)}
                </div>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(item.stockValue)}</TableCell>
              <TableCell className="text-right">{formatNumber(item.currentStock, 1)}</TableCell>
              <TableCell className="text-right">{formatDays(item.daysOfStock)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.stats?.revenue30d)}</TableCell>
              <TableCell className="text-right">
                {item.stats?.avgMarginPercent == null ? '-' : `${formatNumber(item.stats.avgMarginPercent, 1)}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StockErrorsTable({ items }) {
  if (!items || items.length === 0) {
    return <EmptyPanel icon={ClipboardCheck} title="No stock errors found." />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={`${item.productId}-${item.type}-${index}`}>
              <TableCell className="min-w-[180px]">
                <div className="font-medium">{item.name}</div>
                <Badge variant="outline" className="mt-1">{item.category}</Badge>
              </TableCell>
              <TableCell>{item.type?.replaceAll('_', ' ')}</TableCell>
              <TableCell>
                <Badge variant={item.severity === 'high' ? 'destructive' : 'warning'}>{item.severity}</Badge>
              </TableCell>
              <TableCell className="min-w-[280px] text-sm text-muted-foreground">{item.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ReportList({ title, items, renderItem, empty }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h3>
      {items && items.length > 0 ? (
        <div className="space-y-3">
          {items.slice(0, 8).map(renderItem)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

export default function StockAiCommandCenter() {
  const wsinfo = useWsinfoStore((state) => state.wsinfo)
  const storeNo = wsinfo?.storeNo || ''
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [busyItem, setBusyItem] = useState(null)

  const buyingList = plan?.buyingList || {}
  const totalRecommendations = plan?.items?.length || 0

  const groupedItems = useMemo(() => {
    const groups = { Critical: [], High: [], Watch: [] }
    for (const item of plan?.items || []) {
      if (groups[item.riskLevel]) groups[item.riskLevel].push(item)
    }
    return groups
  }, [plan])

  const generatePlan = useCallback(async ({ silent = false } = {}) => {
    if (!storeNo || typeof window === 'undefined' || !window.electronAPI) return
    setGenerating(true)
    try {
      const result = await window.electronAPI.restock('generateStockAiPlan', storeNo)
      if (!result.success) throw new Error(result.error)
      setPlan(result.plan)
      if (!silent) {
        toast({
          title: "Stock AI plan ready",
          description: `${result.plan?.items?.length || 0} buying recommendation(s) generated`,
        })
      }
    } catch (error) {
      console.error('Error generating Stock AI plan:', error)
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate the stock action plan",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }, [storeNo])

  const loadLatestPlan = useCallback(async ({ autoGenerate = false } = {}) => {
    if (!storeNo || typeof window === 'undefined' || !window.electronAPI) return
    setLoading(true)
    try {
      const result = await window.electronAPI.restock('getLatestStockAiPlan', storeNo)
      if (!result.success) throw new Error(result.error)

      const latestPlan = result.plan || null
      setPlan(latestPlan)

      if (autoGenerate && (!latestPlan || latestPlan.date !== todayYmd() || latestPlan.planVersion !== 2)) {
        await generatePlan({ silent: true })
      }
    } catch (error) {
      console.error('Error loading Stock AI plan:', error)
      toast({
        title: "Stock AI unavailable",
        description: error.message || "Failed to load the action plan",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [generatePlan, storeNo])

  const approveItem = async (item) => {
    if (!storeNo || !plan?._id || busyItem) return
    setBusyItem(item.productId)
    try {
      const result = await window.electronAPI.restock('approveStockAiRecommendation', storeNo, plan._id, item.productId)
      if (!result.success) throw new Error(result.error)
      setPlan(result.plan)
      toast({
        title: "Added to restock list",
        description: `${item.name} is ready for the restock workflow`,
      })
    } catch (error) {
      console.error('Error approving recommendation:', error)
      toast({
        title: "Approval failed",
        description: error.message || "Could not approve this recommendation",
        variant: "destructive",
      })
    } finally {
      setBusyItem(null)
    }
  }

  const dismissItem = async (item) => {
    if (!storeNo || !plan?._id || busyItem) return
    const reason = window.prompt('Optional dismissal reason:') || ''
    setBusyItem(item.productId)
    try {
      const result = await window.electronAPI.restock('dismissStockAiRecommendation', storeNo, plan._id, item.productId, reason)
      if (!result.success) throw new Error(result.error)
      setPlan(result.plan)
      toast({
        title: "Recommendation dismissed",
        description: item.name,
      })
    } catch (error) {
      console.error('Error dismissing recommendation:', error)
      toast({
        title: "Dismiss failed",
        description: error.message || "Could not dismiss this recommendation",
        variant: "destructive",
      })
    } finally {
      setBusyItem(null)
    }
  }

  useEffect(() => {
    if (storeNo) {
      loadLatestPlan({ autoGenerate: true })
    }
  }, [loadLatestPlan, storeNo])

  return (
    <div className="container mx-auto space-y-5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-emerald-700" />
            <h1 className="text-3xl font-bold text-neutral-900">Stock AI Command Center</h1>
          </div>
          <p className="mt-1 text-neutral-500">
            Last generated: {formatDateTime(plan?.generatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadLatestPlan()} disabled={loading || generating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => generatePlan()} disabled={generating || !storeNo}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            Regenerate Plan
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/stock/restock-list">
              <PackageCheck className="mr-2 h-4 w-4" />
              Open Restock List
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Buy Today" value={plan?.summary?.buyTodayCount || 0} icon={ShoppingCart} tone="text-red-700" />
        <SummaryCard title="Buy This Week" value={plan?.summary?.buyThisWeekCount || 0} icon={CalendarClock} tone="text-orange-700" />
        <SummaryCard title="Cash Today" value={formatCurrency(plan?.summary?.estimatedCashNeededToday)} icon={Wallet} tone="text-emerald-700" />
        <SummaryCard title="Check Shelf" value={plan?.summary?.checkShelfCount || 0} icon={ClipboardCheck} tone="text-blue-700" />
        <SummaryCard title="Do Not Restock" value={plan?.summary?.doNotRestockCount || 0} icon={ShieldAlert} tone="text-neutral-900" />
      </div>

      {loading || generating ? (
        <div className="flex h-56 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-3 h-8 w-8 animate-spin" />
          {generating ? 'Generating stock action plan...' : 'Loading stock action plan...'}
        </div>
      ) : !plan ? (
        <EmptyPanel title="No Stock AI plan has been generated yet." />
      ) : (
        <Tabs defaultValue="buying" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="buying">Buying List</TabsTrigger>
            <TabsTrigger value="risk">Stockout Risk</TabsTrigger>
            <TabsTrigger value="cash">Cash Protection</TabsTrigger>
            <TabsTrigger value="errors">Stock Errors</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="buying" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5" />
                  Buy Today
                  <Badge variant="destructive">{buyingList.buyToday?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecommendationTable items={buyingList.buyToday || []} onApprove={approveItem} onDismiss={dismissItem} busyItem={busyItem} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Buy This Week
                  <Badge variant="warning">{buyingList.buyThisWeek?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecommendationTable items={buyingList.buyThisWeek || []} onApprove={approveItem} onDismiss={dismissItem} busyItem={busyItem} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldAlert className="h-5 w-5" />
                    Do Not Restock
                    <Badge variant="secondary">{buyingList.doNotRestock?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CashProtectionTable items={buyingList.doNotRestock || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardCheck className="h-5 w-5" />
                    Check Shelf Count
                    <Badge variant="secondary">{buyingList.checkShelfCount?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StockErrorsTable items={buyingList.checkShelfCount || []} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            {totalRecommendations === 0 ? (
              <EmptyPanel title="No stockout risks found for the priority SKU pool." />
            ) : (
              <>
                {[
                  { key: 'Critical', icon: ShieldAlert, badge: 'destructive' },
                  { key: 'High', icon: AlertTriangle, badge: 'warning' },
                  { key: 'Watch', icon: Clock, badge: 'secondary' },
                ].map(({ key, icon: Icon, badge }) => (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5" />
                        {key}
                        <Badge variant={badge}>{groupedItems[key].length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RecommendationTable
                        items={groupedItems[key]}
                        onApprove={approveItem}
                        onDismiss={dismissItem}
                        busyItem={busyItem}
                      />
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="cash">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="h-5 w-5" />
                  Cash Protection
                  <Badge variant="secondary">{plan.cashProtection?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CashProtectionTable items={plan.cashProtection || []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="h-5 w-5" />
                  Stock Errors
                  <Badge variant="secondary">{plan.stockErrors?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StockErrorsTable items={plan.stockErrors || []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Morning Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReportList
                  title="Items at risk of stockout"
                  items={plan.morningReport?.stockoutRisks || []}
                  empty="No urgent stockout risk."
                  renderItem={(item) => (
                    <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatDays(item.daysToStockout)}</span>
                    </div>
                  )}
                />
                <ReportList
                  title="Items to reorder today"
                  items={plan.morningReport?.reorderToday || []}
                  empty="No reorder needed today."
                  renderItem={(item) => (
                    <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.estimatedCost)}</span>
                    </div>
                  )}
                />
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">Estimated cash needed</div>
                  <div className="mt-1 text-2xl font-bold">{formatCurrency(plan.morningReport?.estimatedCashNeeded)}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evening Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReportList
                  title="Fastest movers today"
                  items={plan.eveningReport?.fastestMoversToday || []}
                  empty="No sales movement recorded today."
                  renderItem={(item) => (
                    <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatNumber(item.todaySold, 1)} units</span>
                    </div>
                  )}
                />
                <ReportList
                  title="Running lower than expected"
                  items={plan.eveningReport?.runningLowerThanExpected || []}
                  empty="No item is running unusually low."
                  renderItem={(item) => (
                    <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatNumber(item.todaySold, 1)} sold</span>
                    </div>
                  )}
                />
                <ReportList
                  title="Tomorrow priorities"
                  items={plan.eveningReport?.tomorrowBuyingPriorities || []}
                  empty="No buying priority queued for tomorrow."
                  renderItem={(item) => (
                    <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.estimatedCost)}</span>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
