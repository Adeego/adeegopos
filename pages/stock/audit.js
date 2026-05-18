import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ClipboardCheck,
  TrendingDown,
  TrendingUp,
  Target,
  BarChart3,
  Loader2,
  CheckCircle2,
  Minus,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import useWsinfoStore from '@/stores/wsinfo'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'

const CATEGORIES = ['Primary', 'Secondary', 'Perishable', 'Drinks', 'Reserve']

export default function StockAuditPage() {
  const [activeTab, setActiveTab] = useState('audit')
  const store = useWsinfoStore((state) => state.wsinfo)
  const [storeNo, setStoreNo] = useState('')

  useEffect(() => {
    if (store && store.storeNo) {
      setStoreNo(store.storeNo)
    }
  }, [store])

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Stock Audit</h1>
          <p className="text-neutral-500 mt-1">Weekly inventory count, shrinkage tracking & health</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="audit" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            New Audit
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            History & Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-4">
          {storeNo && <AuditTab storeNo={storeNo} />}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {storeNo && <HistoryTab storeNo={storeNo} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// New Audit Tab
// ============================================================
function AuditTab({ storeNo }) {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [counts, setCounts] = useState({})
  const [categories, setCategories] = useState({})
  const [productExpiry, setProductExpiry] = useState({})
  const [filterCategory, setFilterCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  const startAudit = async () => {
    try {
      setLoading(true)
      const result = await window.electronAPI.realmOperation('createAudit', storeNo)
      if (result.success) {
        setAudit(result.audit)
        // Pre-fill counts with system stock
        const initialCounts = {}
        const initialCategories = {}
        const initialExpiry = {}
        for (const item of result.audit.items) {
          initialCounts[item.productId] = item.systemStock
          initialCategories[item.productId] = item.category
          // Pre-fill expiry from the first batch if it exists
          const firstBatch = (item.batches || [])[0]
          initialExpiry[item.productId] = firstBatch?.expiryDate || ''
        }
        setCounts(initialCounts)
        setCategories(initialCategories)
        setProductExpiry(initialExpiry)
        toast({ title: "Audit Started", description: `${result.audit.items.length} products loaded for counting` })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const submitAudit = async () => {
    if (!audit) return

    try {
      setSubmitting(true)
      const countsArray = audit.items.map((item) => {
        return {
          productId: item.productId,
          physicalCount: Number(counts[item.productId] ?? item.systemStock),
          category: categories[item.productId] || item.category,
          expiryDate: productExpiry[item.productId] || null,
        }
      })

      const result = await window.electronAPI.realmOperation('submitAudit', audit._id, countsArray)
      if (result.success) {
        setAudit(result.audit)
        toast({
          title: "Audit Completed",
          description: `${result.audit.summary.discrepancyCount} discrepancies found. Stock adjusted.`,
        })
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCountChange = (productId, value) => {
    setCounts((prev) => ({ ...prev, [productId]: value }))
  }

  const handleCategoryChange = (productId, value) => {
    setCategories((prev) => ({ ...prev, [productId]: value }))
  }

  const handleExpiryChange = (productId, value) => {
    setProductExpiry((prev) => ({ ...prev, [productId]: value }))
  }

  const filteredItems = useMemo(() => {
    if (!audit) return []
    return audit.items.filter((item) => {
      const currentCategory = categories[item.productId] || item.category
      const matchCategory = filterCategory === 'All' || currentCategory === filterCategory
      const matchSearch = !searchTerm || item.productName.toLowerCase().includes(searchTerm.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [audit, categories, filterCategory, searchTerm])

  const discrepancySummary = useMemo(() => {
    if (!audit || audit.status === 'completed') return null
    let shrinkageCount = 0
    let overageCount = 0
    let matchCount = 0
    for (const item of audit.items) {
      const physical = Number(counts[item.productId] ?? item.systemStock)
      const diff = item.systemStock - physical
      if (diff > 0) shrinkageCount++
      else if (diff < 0) overageCount++
      else matchCount++
    }
    return { shrinkageCount, overageCount, matchCount, total: audit.items.length }
  }, [audit, counts])

  // No audit started
  if (!audit) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <ClipboardCheck className="h-16 w-16 text-neutral-300" />
          <h3 className="text-lg font-semibold text-neutral-700">Start a New Stock Audit</h3>
          <p className="text-neutral-500 text-sm text-center max-w-md">
            Count all products in your store. System stock will be auto-adjusted to match your physical counts.
          </p>
          <Button onClick={startAudit} disabled={loading} size="lg" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Start Audit
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Audit completed — show results
  if (audit.status === 'completed') {
    return (
      <div className="space-y-4">
        <AuditResultCards summary={audit.summary} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Audit Complete — {new Date(audit.completedAt).toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditItemsTable items={audit.items} completed />
            <div className="mt-4 flex justify-end">
              <Button onClick={() => { setAudit(null); setCounts({}); setCategories({}); setProductExpiry({}); }} variant="outline">
                Start New Audit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Audit in progress
  return (
    <div className="space-y-4">
      {/* Live summary */}
      {discrepancySummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniCard label="Total Products" value={discrepancySummary.total} />
          <MiniCard label="Match" value={discrepancySummary.matchCount} color="text-green-600" />
          <MiniCard label="Shrinkage" value={discrepancySummary.shrinkageCount} color="text-red-600" />
          <MiniCard label="Overage" value={discrepancySummary.overageCount} color="text-blue-600" />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Counting — {audit.items.length} products
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Category</TableHead>
                  <TableHead className="text-center">Expiry Date</TableHead>
                  <TableHead className="text-center">System Stock</TableHead>
                  <TableHead className="text-center">Physical Count</TableHead>
                  <TableHead className="text-center">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const physical = Number(counts[item.productId] ?? item.systemStock)
                  const variance = item.systemStock - physical

                  return (
                    <TableRow
                      key={item.productId}
                      className={variance > 0 ? 'bg-red-50' : variance < 0 ? 'bg-blue-50' : ''}
                    >
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center">
                        <select
                          value={categories[item.productId] || item.category}
                          onChange={(e) => handleCategoryChange(item.productId, e.target.value)}
                          className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="date"
                          value={productExpiry[item.productId] || ''}
                          onChange={(e) => handleExpiryChange(item.productId, e.target.value)}
                          className="w-40 mx-auto text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-center font-mono">{item.systemStock}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={counts[item.productId] ?? ''}
                          onChange={(e) => handleCountChange(item.productId, e.target.value)}
                          className="w-24 mx-auto text-center font-mono"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold font-mono ${
                          variance > 0 ? 'text-red-600' : variance < 0 ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {variance > 0 ? `-${variance}` : variance < 0 ? `+${Math.abs(variance)}` : '0'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAudit(null); setCounts({}); setCategories({}); setProductExpiry({}); }}>
              Cancel
            </Button>
            <Button onClick={submitAudit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Submit Audit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// History & Health Tab
// ============================================================
function HistoryTab({ storeNo }) {
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [storeNo])

  const loadData = async () => {
    try {
      setLoading(true)
      const [summaryResult, historyResult] = await Promise.all([
        window.electronAPI.realmOperation('getAuditSummary', storeNo),
        window.electronAPI.realmOperation('getAuditHistory', storeNo, 50),
      ])
      if (summaryResult.success) setSummary(summaryResult.summary)
      if (historyResult.success) setHistory(historyResult.audits)
    } catch (error) {
      console.error('Error loading audit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const viewAuditDetail = async (auditId) => {
    try {
      setDetailLoading(true)
      const result = await window.electronAPI.realmOperation('getAudit', auditId)
      if (result.success) {
        setSelectedAudit(result.audit)
      }
    } catch (error) {
      console.error('Error loading audit detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const chartData = useMemo(() => {
    return [...history].reverse().map((a) => ({
      date: new Date(a.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      shrinkageRate: a.summary?.shrinkageRate ?? 0,
      accuracyRate: a.summary?.accuracyRate ?? 0,
      shrinkageValue: a.summary?.totalShrinkageValue ?? 0,
    }))
  }, [history])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAudits}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Shrinkage</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.latestShrinkageValue)}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {summary.latestShrinkageRate}% of products
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
              <Target className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.latestAccuracyRate}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trend</CardTitle>
              {summary.trend === 'improving'
                ? <TrendingDown className="h-4 w-4 text-green-500" />
                : summary.trend === 'worsening'
                ? <TrendingUp className="h-4 w-4 text-red-500" />
                : <Minus className="h-4 w-4 text-neutral-400" />
              }
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                summary.trend === 'improving' ? 'text-green-600' :
                summary.trend === 'worsening' ? 'text-red-600' : 'text-neutral-600'
              }`}>
                {summary.trend === 'improving' ? 'Improving' :
                 summary.trend === 'worsening' ? 'Worsening' : 'Stable'}
              </div>
              {summary.trendDelta !== 0 && (
                <p className="text-xs text-neutral-500 mt-1">
                  {summary.trendDelta > 0 ? '+' : ''}{summary.trendDelta}% vs last audit
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shrinkage Trend Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Shrinkage Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === 'shrinkageRate' ? `${value}%` : `${value}%`,
                    name === 'shrinkageRate' ? 'Shrinkage Rate' : 'Accuracy Rate',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="shrinkageRate"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="shrinkageRate"
                />
                <Line
                  type="monotone"
                  dataKey="accuracyRate"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="accuracyRate"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Audit History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Audit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
              <p>No completed audits yet</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Products</TableHead>
                    <TableHead className="text-center">Discrepancies</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead className="text-right">Shrinkage Value</TableHead>
                    <TableHead className="text-center">Expiry Updates</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((audit) => (
                    <TableRow key={audit._id}>
                      <TableCell className="font-medium">
                        {new Date(audit.completedAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-center">{audit.summary?.totalProducts ?? 0}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={audit.summary?.discrepancyCount > 0 ? 'destructive' : 'default'}>
                          {audit.summary?.discrepancyCount ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={
                          (audit.summary?.accuracyRate ?? 0) >= 95 ? 'text-green-600 font-semibold' :
                          (audit.summary?.accuracyRate ?? 0) >= 80 ? 'text-yellow-600 font-semibold' :
                          'text-red-600 font-semibold'
                        }>
                          {audit.summary?.accuracyRate ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(audit.summary?.totalShrinkageValue ?? 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {audit.summary?.expiryUpdatesCount > 0 && (
                          <Badge variant="outline">{audit.summary.expiryUpdatesCount}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewAuditDetail(audit._id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Audit Detail — {selectedAudit && new Date(selectedAudit.completedAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : selectedAudit && (
            <div className="space-y-4">
              <AuditResultCards summary={selectedAudit.summary} />
              <AuditItemsTable items={selectedAudit.items} completed />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Shared Components
// ============================================================

function AuditResultCards({ summary }) {
  if (!summary) return null

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MiniCard label="Products Counted" value={summary.totalProducts} />
      <MiniCard label="Discrepancies" value={summary.discrepancyCount} color="text-red-600" />
      <MiniCard label="Shrinkage Value" value={formatCurrency(summary.totalShrinkageValue)} color="text-red-600" />
      <MiniCard label="Accuracy" value={`${summary.accuracyRate}%`} color="text-green-600" />
    </div>
  )
}

function AuditItemsTable({ items, completed }) {
  if (!items || items.length === 0) return null

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Only show items with discrepancies first, then the rest
  const sorted = [...items].sort((a, b) => {
    const aVar = Math.abs(a.variance || 0)
    const bVar = Math.abs(b.variance || 0)
    return bVar - aVar
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-center">Category</TableHead>
            <TableHead className="text-center">Expiry</TableHead>
            <TableHead className="text-center">System</TableHead>
            <TableHead className="text-center">Physical</TableHead>
            <TableHead className="text-center">Variance</TableHead>
            <TableHead className="text-right">Shrinkage Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => {
            const variance = item.variance || 0
            return (
              <TableRow
                key={item.productId}
                className={variance > 0 ? 'bg-red-50' : variance < 0 ? 'bg-blue-50' : ''}
              >
                <TableCell className="font-medium">
                  <span>{item.productName}</span>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {item.categoryChange && (
                      <Badge variant="outline" className="text-xs">
                        {item.categoryChange.oldCategory} → {item.categoryChange.newCategory}
                      </Badge>
                    )}
                    {item.expiryChanges && item.expiryChanges.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {item.expiryChanges.length} expiry updated
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{item.category}</Badge>
                </TableCell>
                <TableCell className="text-center text-sm">
                  {item.expiryChanges && item.expiryChanges.length > 0
                    ? item.expiryChanges[0].newExpiry || '—'
                    : (item.batches && item.batches[0]?.expiryDate) || '—'
                  }
                </TableCell>
                <TableCell className="text-center font-mono">{item.systemStock}</TableCell>
                <TableCell className="text-center font-mono">{item.physicalCount}</TableCell>
                <TableCell className="text-center">
                  {variance !== 0 ? (
                    <span className={`font-semibold font-mono ${
                      variance > 0 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {variance > 0 ? `-${variance}` : `+${Math.abs(variance)}`}
                    </span>
                  ) : (
                    <span className="text-green-600 font-mono">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {variance > 0 ? (
                    <span className="text-red-600">{formatCurrency(item.shrinkageValue)}</span>
                  ) : variance < 0 ? (
                    <span className="text-blue-600">{formatCurrency(item.shrinkageValue)}</span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function MiniCard({ label, value, color = 'text-neutral-900' }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
