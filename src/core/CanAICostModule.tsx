import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Check, Search, TrendingUp, Calendar, History as HistoryIcon, ChevronDown
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Legend, Area, Line } from 'recharts'

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year'

const periodLabels: Record<PeriodType, string> = {
  today: '今日', week: '本周', month: '本月', quarter: '本季', year: '年度',
}

interface ProviderCost {
  name: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  requests: number
  toolCalls: number
  webSearch: number
  cost: number
  price: string
  codingPlan: boolean
  color: string
}

const mockPeriodData: Record<PeriodType, { dailyData: { date: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[]; providers: ProviderCost[]; summary: { totalTokens: number; inputTokens: number; outputTokens: number; requests: number; toolCalls: number; webSearch: number; totalCost: number } }> = {
  today: {
    dailyData: Array.from({ length: 24 }, (_, i) => ({ date: `${i}:00`, cost: Math.random() * 0.5 + 0.1, tokens: Math.floor(Math.random() * 5000 + 1000), inputTokens: Math.floor(Math.random() * 3000 + 500), outputTokens: Math.floor(Math.random() * 2000 + 300) })),
    providers: [
      { name: 'DeepSeek', totalTokens: 185000, inputTokens: 120000, outputTokens: 65000, requests: 89, toolCalls: 156, webSearch: 12, cost: 0.85, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 96000, inputTokens: 62000, outputTokens: 34000, requests: 45, toolCalls: 78, webSearch: 8, cost: 0.42, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 45000, inputTokens: 28000, outputTokens: 17000, requests: 22, toolCalls: 35, webSearch: 5, cost: 0.38, price: '¥3.2/M tokens', codingPlan: false, color: '#10b981' },
    ],
    summary: { totalTokens: 326000, inputTokens: 210000, outputTokens: 116000, requests: 156, toolCalls: 269, webSearch: 25, totalCost: 1.65 },
  },
  week: {
    dailyData: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { date: `${d.getMonth() + 1}/${d.getDate()}`, cost: Math.random() * 3 + 0.5, tokens: Math.floor(Math.random() * 50000 + 10000), inputTokens: Math.floor(Math.random() * 30000 + 5000), outputTokens: Math.floor(Math.random() * 20000 + 3000) };
    }),
    providers: [
      { name: 'DeepSeek', totalTokens: 1250000, inputTokens: 820000, outputTokens: 430000, requests: 623, toolCalls: 1120, webSearch: 85, cost: 5.85, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 680000, inputTokens: 440000, outputTokens: 240000, requests: 334, toolCalls: 580, webSearch: 42, cost: 3.12, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 320000, inputTokens: 200000, outputTokens: 120000, requests: 158, toolCalls: 260, webSearch: 28, cost: 2.75, price: '¥3.2/M tokens', codingPlan: false, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 156000, inputTokens: 98000, outputTokens: 58000, requests: 76, toolCalls: 130, webSearch: 15, cost: 0.98, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
    ],
    summary: { totalTokens: 2406000, inputTokens: 1558000, outputTokens: 848000, requests: 1191, toolCalls: 2090, webSearch: 170, totalCost: 12.70 },
  },
  month: {
    dailyData: Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i)); return { date: `${d.getMonth() + 1}/${d.getDate()}`, cost: Math.random() * 4 + 0.3, tokens: Math.floor(Math.random() * 60000 + 8000), inputTokens: Math.floor(Math.random() * 40000 + 4000), outputTokens: Math.floor(Math.random() * 20000 + 2000) };
    }),
    providers: [
      { name: 'DeepSeek', totalTokens: 5200000, inputTokens: 3400000, outputTokens: 1800000, requests: 2560, toolCalls: 4850, webSearch: 380, cost: 24.50, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 2800000, inputTokens: 1800000, outputTokens: 1000000, requests: 1380, toolCalls: 2520, webSearch: 195, cost: 12.80, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 1350000, inputTokens: 850000, outputTokens: 500000, requests: 670, toolCalls: 1150, webSearch: 110, cost: 11.50, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 650000, inputTokens: 420000, outputTokens: 230000, requests: 320, toolCalls: 560, webSearch: 65, cost: 4.20, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
      { name: 'Volcengine', totalTokens: 380000, inputTokens: 240000, outputTokens: 140000, requests: 190, toolCalls: 320, webSearch: 40, cost: 2.45, price: '¥1.2/M tokens', codingPlan: false, color: '#06b6d4' },
    ],
    summary: { totalTokens: 10380000, inputTokens: 6710000, outputTokens: 3670000, requests: 5120, toolCalls: 9400, webSearch: 790, totalCost: 55.45 },
  },
  quarter: {
    dailyData: Array.from({ length: 90 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (89 - i));
      const weekNum = Math.floor(i / 7) + 1;
      return { date: i % 7 === 0 ? `W${weekNum}` : '', cost: Math.random() * 5 + 0.5, tokens: Math.floor(Math.random() * 70000 + 10000), inputTokens: Math.floor(Math.random() * 45000 + 5000), outputTokens: Math.floor(Math.random() * 25000 + 3000) };
    }).filter(d => d.date !== ''),
    providers: [
      { name: 'DeepSeek', totalTokens: 15000000, inputTokens: 9800000, outputTokens: 5200000, requests: 7500, toolCalls: 14200, webSearch: 1150, cost: 71.20, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 8200000, inputTokens: 5300000, outputTokens: 2900000, requests: 4100, toolCalls: 7500, webSearch: 580, cost: 36.80, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 4000000, inputTokens: 2500000, outputTokens: 1500000, requests: 2000, toolCalls: 3500, webSearch: 320, cost: 33.50, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 1900000, inputTokens: 1200000, outputTokens: 700000, requests: 950, toolCalls: 1680, webSearch: 190, cost: 12.00, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
      { name: 'Volcengine', totalTokens: 1100000, inputTokens: 700000, outputTokens: 400000, requests: 560, toolCalls: 980, webSearch: 110, cost: 7.20, price: '¥1.2/M tokens', codingPlan: false, color: '#06b6d4' },
    ],
    summary: { totalTokens: 30200000, inputTokens: 19500000, outputTokens: 10700000, requests: 15110, toolCalls: 27860, webSearch: 2350, totalCost: 160.70 },
  },
  year: {
    dailyData: Array.from({ length: 12 }, (_, i) => ({ date: `${i + 1}月`, cost: Math.random() * 30 + 10, tokens: Math.floor(Math.random() * 500000 + 100000), inputTokens: Math.floor(Math.random() * 300000 + 50000), outputTokens: Math.floor(Math.random() * 200000 + 30000) })),
    providers: [
      { name: 'DeepSeek', totalTokens: 62000000, inputTokens: 40000000, outputTokens: 22000000, requests: 31000, toolCalls: 58000, webSearch: 4800, cost: 295.00, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 34000000, inputTokens: 22000000, outputTokens: 12000000, requests: 17000, toolCalls: 31000, webSearch: 2400, cost: 152.00, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 16800000, inputTokens: 10500000, outputTokens: 6300000, requests: 8400, toolCalls: 14800, webSearch: 1350, cost: 141.00, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 7800000, inputTokens: 5000000, outputTokens: 2800000, requests: 3900, toolCalls: 6900, webSearch: 780, cost: 49.00, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
      { name: 'Volcengine', totalTokens: 4500000, inputTokens: 2800000, outputTokens: 1700000, requests: 2300, toolCalls: 4000, webSearch: 460, cost: 29.50, price: '¥1.2/M tokens', codingPlan: false, color: '#06b6d4' },
    ],
    summary: { totalTokens: 125100000, inputTokens: 80300000, outputTokens: 44800000, requests: 62600, toolCalls: 114700, webSearch: 9790, totalCost: 666.50 },
  },
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export default function CanAICostModule() {
  const [period, setPeriod] = useState<PeriodType>('today')
  const [viewMode, setViewMode] = useState<'period' | 'history'>('period')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [providersData, setProvidersData] = useState<Record<string, ProviderCost[]>>(() => {
    const initial: Record<string, ProviderCost[]> = {}
    for (const key of Object.keys(mockPeriodData) as PeriodType[]) {
      initial[key] = mockPeriodData[key].providers.map(p => ({ ...p }))
    }
    return initial
  })
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')

  const data = mockPeriodData[period]
  const currentProviders = providersData[period] || data.providers

  const toggleCodingPlan = (providerName: string) => {
    setProvidersData(prev => ({
      ...prev,
      [period]: prev[period].map(p =>
        p.name === providerName ? { ...p, codingPlan: !p.codingPlan } : p
      )
    }))
  }

  const startEditPrice = (providerName: string, currentPrice: string) => {
    setEditingPrice(providerName)
    setEditPriceValue(currentPrice)
  }

  const saveEditPrice = (providerName: string) => {
    setProvidersData(prev => ({
      ...prev,
      [period]: prev[period].map(p =>
        p.name === providerName ? { ...p, price: editPriceValue } : p
      )
    }))
    setEditingPrice(null)
  }

  const cancelEditPrice = () => { setEditingPrice(null) }

  const [historyProviders, setHistoryProviders] = useState<ProviderCost[]>([
    { name: 'DeepSeek', totalTokens: 980000, inputTokens: 640000, outputTokens: 340000, requests: 445, toolCalls: 820, webSearch: 62, cost: 4.58, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
    { name: 'Qwen', totalTokens: 520000, inputTokens: 340000, outputTokens: 180000, requests: 260, toolCalls: 470, webSearch: 38, cost: 2.85, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
    { name: 'GPT-4o Mini', totalTokens: 250000, inputTokens: 160000, outputTokens: 90000, requests: 125, toolCalls: 215, webSearch: 28, cost: 2.42, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
  ])

  const toggleHistCodingPlan = (providerName: string) => {
    setHistoryProviders(prev => prev.map(p =>
      p.name === providerName ? { ...p, codingPlan: !p.codingPlan } : p
    ))
  }

  const saveHistEditPrice = (providerName: string) => {
    setHistoryProviders(prev => prev.map(p =>
      p.name === providerName ? { ...p, price: editPriceValue } : p
    ))
    setEditingPrice(null)
  }

  const handleHistoryQuery = () => {}

  const METRIC_OPTIONS = [
    { key: 'cost', label: '总费用（柱）', color: '#f59e0b' },
    { key: 'totalTokens', label: '总token量（柱）', color: '#8b5cf6' },
    { key: 'inputTokens', label: '输入量（柱）', color: '#3b82f6' },
    { key: 'outputTokens', label: '输出量（柱）', color: '#10b981' },
    { key: 'requests', label: '请求次数（柱）', color: '#ec4899' },
    { key: 'toolCalls', label: '调工具次数（柱）', color: '#06b6d4' },
  ]

  const PERIOD_METRIC_OPTIONS = [
    { key: 'cost', label: '总费用（线）', color: '#f59e0b' },
    { key: 'totalTokens', label: '总token量（柱）', color: '#8b5cf6' },
    { key: 'inputTokens', label: '输入量（柱）', color: '#3b82f6' },
    { key: 'outputTokens', label: '输出量（柱）', color: '#10b981' },
    { key: 'requests', label: '请求次数（柱）', color: '#ec4899' },
    { key: 'toolCalls', label: '调工具次数（柱）', color: '#06b6d4' },
  ]

  const [histChartMetrics, setHistChartMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const [showHistMetricMenu, setShowHistMetricMenu] = useState(false)
  const [tempHistMetrics, setTempHistMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const histMetricBtnRef = useRef<HTMLButtonElement>(null)

  const [histProviderCharts, setHistProviderCharts] = useState<Set<string>>(new Set(['DeepSeek', 'Qwen']))
  const [showHistProviderMenu, setShowHistProviderMenu] = useState(false)
  const [tempHistProviders, setTempHistProviders] = useState<Set<string>>(new Set(['DeepSeek', 'Qwen']))
  const histProviderBtnRef = useRef<HTMLButtonElement>(null)

  const [periodChartMetrics, setPeriodChartMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const [showPeriodMetricMenu, setShowPeriodMetricMenu] = useState(false)
  const [tempPeriodMetrics, setTempPeriodMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const periodMetricBtnRef = useRef<HTMLButtonElement>(null)

  const [periodProviderCharts, setPeriodProviderCharts] = useState<Set<string>>(new Set(['DeepSeek', 'Qwen']))
  const [showPeriodProviderMenu, setShowPeriodProviderMenu] = useState(false)
  const [tempPeriodProviders, setTempPeriodProviders] = useState<Set<string>>(new Set(['DeepSeek', 'Qwen']))
  const periodProviderBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      let shouldClose = true
      if (showHistMetricMenu) {
        const btn = histMetricBtnRef.current
        const menu = document.querySelector('[data-menu="hist-metric"]')
        if (btn?.contains(target) || menu?.contains(target)) shouldClose = false
      }
      if (showPeriodMetricMenu) {
        const btn = periodMetricBtnRef.current
        const menu = document.querySelector('[data-menu="period-metric"]')
        if (btn?.contains(target) || menu?.contains(target)) shouldClose = false
      }
      if (showPeriodProviderMenu) {
        const btn = periodProviderBtnRef.current
        const menu = document.querySelector('[data-menu="period-provider"]')
        if (btn?.contains(target) || menu?.contains(target)) shouldClose = false
      }
      if (shouldClose) {
        setShowHistMetricMenu(false)
        setShowPeriodMetricMenu(false)
        setShowPeriodProviderMenu(false)
      }
    }
    if (showHistMetricMenu || showPeriodMetricMenu || showPeriodProviderMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistMetricMenu, showPeriodMetricMenu, showPeriodProviderMenu])

  const renderPeriodContent = () => (
    <>
      {/* 概览统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总 Token</span>
          <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatNumber(data.summary.totalTokens)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输入量</span>
          <div className="mt-1 text-lg font-bold text-blue-500">{formatNumber(data.summary.inputTokens)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输出量</span>
          <div className="mt-1 text-lg font-bold text-green-500">{formatNumber(data.summary.outputTokens)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">请求次数</span>
          <div className="mt-1 text-lg font-bold text-purple-500">{formatNumber(data.summary.requests)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">工具调用</span>
          <div className="mt-1 text-lg font-bold text-cyan-500">{formatNumber(data.summary.toolCalls)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">网络搜索</span>
          <div className="mt-1 text-lg font-bold text-yellow-500">{formatNumber(data.summary.webSearch)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总费用</span>
          <div className="mt-1 text-lg font-bold text-orange-500">${data.summary.totalCost.toFixed(2)}</div>
        </div>
      </div>

      {/* 图表：费用曲线 + Token柱状图 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">费用趋势 & Token 用量</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.dailyData}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(1)}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="cost" stroke="#3b82f6" fill="url(#colorCost)" strokeWidth={2} name="费用" />
              <Bar yAxisId="right" dataKey="tokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={8} name="总Token" />
              <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} name="输入量" />
              <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={8} name="输出量" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各提供商消费明细 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">各提供商消费明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">提供商</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">总 Token</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输入量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输出量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">请求次数</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">工具调用</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">网络搜索</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">价格</th>
                <th className="text-center py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">CodingPlan</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">消费金额</th>
              </tr>
            </thead>
            <tbody>
              {currentProviders.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.totalTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.inputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.outputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.requests)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.toolCalls)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.webSearch)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">
                    {editingPrice === p.name ? (
                      <div className="flex items-center justify-end gap-1">
                        <input type="text" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)}
                          className="w-28 px-2 py-1 bg-white dark:bg-gray-700 border border-blue-500 rounded text-xs text-gray-900 dark:text-white focus:outline-none" autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditPrice(p.name); if (e.key === 'Escape') cancelEditPrice(); }} />
                        <button onClick={() => saveEditPrice(p.name)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check className="w-3 h-3" /></button>
                        <button onClick={cancelEditPrice} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEditPrice(p.name, p.price)}
                        className="text-xs text-gray-600 dark:text-gray-300 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 rounded transition-colors" title="点击编辑价格">{p.price}</button>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button onClick={() => toggleCodingPlan(p.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${p.codingPlan ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {p.codingPlan ? 'CodingPlan' : '按量'}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900 dark:text-white">${p.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 历史提供商消费对比 - 可配置指标 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">历史提供商消费对比</h3>
          <div className="relative">
            <button ref={histMetricBtnRef} onClick={() => { setShowHistMetricMenu(v => !v); if (!showHistMetricMenu) setTempHistMetrics(new Set(histChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <TrendingUp className="w-3 h-3" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showHistMetricMenu && createPortal(
              <div data-menu="hist-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: histMetricBtnRef.current ? histMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: histMetricBtnRef.current ? Math.min(histMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempHistMetrics.size === METRIC_OPTIONS.length}
                    onChange={() => { if (tempHistMetrics.size === METRIC_OPTIONS.length) setTempHistMetrics(new Set()); else setTempHistMetrics(new Set(METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempHistMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempHistMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempHistMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setHistChartMetrics(new Set(tempHistMetrics)); setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentProviders.map(p => ({
              name: p.name, color: p.color,
              ...METRIC_OPTIONS.reduce((acc, m) => ({ ...acc, [m.label]: p[m.key as keyof ProviderCost] }), {}),
            }))} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              {METRIC_OPTIONS.filter(m => histChartMetrics.has(m.key)).map(m => (
                <Bar key={m.key} yAxisId={m.key === 'cost' ? 'left' : (m.key === 'requests' || m.key === 'toolCalls' ? 'count' : 'right')} dataKey={m.label} fill={m.color} radius={[2, 2, 0, 0]} barSize={12} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各提供商历史消费 - 多周期对比 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">各提供商历史消费</h3>
          <div className="relative">
            <button ref={periodMetricBtnRef} onClick={() => { setShowPeriodMetricMenu(v => !v); if (!showPeriodMetricMenu) setTempPeriodMetrics(new Set(periodChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodMetricMenu && createPortal(
              <div data-menu="period-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodMetricBtnRef.current ? periodMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodMetricBtnRef.current ? Math.min(periodMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length}
                    onChange={() => { if (tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length) setTempPeriodMetrics(new Set()); else setTempPeriodMetrics(new Set(PERIOD_METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {PERIOD_METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempPeriodMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempPeriodMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodChartMetrics(new Set(tempPeriodMetrics)); setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
          <div className="relative">
            <button ref={periodProviderBtnRef} onClick={() => { setShowPeriodProviderMenu(v => !v); if (!showPeriodProviderMenu) setTempPeriodProviders(new Set(periodProviderCharts)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />选择提供商 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodProviderMenu && createPortal(
              <div data-menu="period-provider" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodProviderBtnRef.current ? periodProviderBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodProviderBtnRef.current ? Math.min(periodProviderBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodProviders.size === data.providers.length}
                    onChange={() => { if (tempPeriodProviders.size === data.providers.length) setTempPeriodProviders(new Set()); else setTempPeriodProviders(new Set(data.providers.map(p => p.name))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {data.providers.map(p => (
                  <label key={p.name} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodProviders.has(p.name)}
                      onChange={() => { const n = new Set(tempPeriodProviders); if (n.has(p.name)) n.delete(p.name); else n.add(p.name); setTempPeriodProviders(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodProviderCharts(new Set(tempPeriodProviders)); setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="space-y-6 max-h-[700px] overflow-y-auto">
          {data.providers.filter(p => periodProviderCharts.has(p.name)).slice(0, 5).map((provider) => {
            const periodData = (Object.keys(periodLabels) as PeriodType[]).map(periodKey => {
              const pData = mockPeriodData[periodKey].providers.find(p => p.name === provider.name)
              return {
                period: periodLabels[periodKey],
                totalTokens: pData?.totalTokens || 0,
                inputTokens: pData?.inputTokens || 0,
                outputTokens: pData?.outputTokens || 0,
                requests: pData?.requests || 0,
                toolCalls: pData?.toolCalls || 0,
                cost: pData?.cost || 0,
              }
            })
            return (
              <div key={provider.name}>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                  {provider.name}
                </h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => formatNumber(v)} />
                      <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip />
                      <Legend />
                      {periodChartMetrics.has('totalTokens') && <Bar yAxisId="right" dataKey="totalTokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={10} name="总token量（柱）" />}
                      {periodChartMetrics.has('inputTokens') && <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={10} name="输入量（柱）" />}
                      {periodChartMetrics.has('outputTokens') && <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={10} name="输出量（柱）" />}
                      {periodChartMetrics.has('requests') && <Bar yAxisId="count" dataKey="requests" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={10} name="请求次数（柱）" />}
                      {periodChartMetrics.has('toolCalls') && <Bar yAxisId="count" dataKey="toolCalls" fill="#06b6d4" radius={[2, 2, 0, 0]} barSize={10} name="调工具次数（柱）" />}
                      {periodChartMetrics.has('cost') && <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} name="总费用（线）" dot={{ r: 3 }} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  const renderHistoryContent = () => (
    <>
      {/* 历史概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总 Token</span>
          <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">1.72M</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输入量</span>
          <div className="mt-1 text-lg font-bold text-blue-500">1.12M</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输出量</span>
          <div className="mt-1 text-lg font-bold text-green-500">606K</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">请求次数</span>
          <div className="mt-1 text-lg font-bold text-purple-500">892</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">工具调用</span>
          <div className="mt-1 text-lg font-bold text-cyan-500">1.5K</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">网络搜索</span>
          <div className="mt-1 text-lg font-bold text-yellow-500">128</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总费用</span>
          <div className="mt-1 text-lg font-bold text-orange-500">$9.85</div>
        </div>
      </div>

      {/* 历史费用趋势图 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">历史费用趋势 & Token 用量</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={Array.from({ length: 7 }, (_, i) => {
              const d = new Date(historyFrom || Date.now()); d.setDate(d.getDate() + i);
              return { date: `${d.getMonth() + 1}/${d.getDate()}`, cost: Math.random() * 2 + 0.5, tokens: Math.floor(Math.random() * 30000 + 5000), inputTokens: Math.floor(Math.random() * 20000 + 2000), outputTokens: Math.floor(Math.random() * 10000 + 1000) };
            })}>
              <defs>
                <linearGradient id="colorHistCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(1)}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="cost" stroke="#f59e0b" fill="url(#colorHistCost)" strokeWidth={2} name="费用" />
              <Bar yAxisId="right" dataKey="tokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={8} name="总Token" />
              <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} name="输入量" />
              <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={8} name="输出量" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 历史各提供商用量对比柱状图 - 可配置指标 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">历史提供商消费对比</h3>
          <div className="relative">
            <button ref={histMetricBtnRef} onClick={() => { setShowHistMetricMenu(v => !v); if (!showHistMetricMenu) setTempHistMetrics(new Set(histChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <TrendingUp className="w-3 h-3" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showHistMetricMenu && createPortal(
              <div data-menu="hist-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: histMetricBtnRef.current ? histMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: histMetricBtnRef.current ? Math.min(histMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempHistMetrics.size === METRIC_OPTIONS.length}
                    onChange={() => { if (tempHistMetrics.size === METRIC_OPTIONS.length) setTempHistMetrics(new Set()); else setTempHistMetrics(new Set(METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempHistMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempHistMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempHistMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setHistChartMetrics(new Set(tempHistMetrics)); setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historyProviders.map(p => ({
              name: p.name, color: p.color,
              ...METRIC_OPTIONS.reduce((acc, m) => ({ ...acc, [m.label]: p[m.key as keyof ProviderCost] }), {}),
            }))} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              {METRIC_OPTIONS.filter(m => histChartMetrics.has(m.key)).map(m => (
                <Bar key={m.key} yAxisId={m.key === 'cost' ? 'left' : (m.key === 'requests' || m.key === 'toolCalls' ? 'count' : 'right')} dataKey={m.label} fill={m.color} radius={[2, 2, 0, 0]} barSize={12} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各提供商历史消费 - 多周期对比 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">各提供商历史消费</h3>
          <div className="relative">
            <button ref={periodMetricBtnRef} onClick={() => { setShowPeriodMetricMenu(v => !v); if (!showPeriodMetricMenu) setTempPeriodMetrics(new Set(periodChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodMetricMenu && createPortal(
              <div data-menu="period-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodMetricBtnRef.current ? periodMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodMetricBtnRef.current ? Math.min(periodMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length}
                    onChange={() => { if (tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length) setTempPeriodMetrics(new Set()); else setTempPeriodMetrics(new Set(PERIOD_METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {PERIOD_METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempPeriodMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempPeriodMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodChartMetrics(new Set(tempPeriodMetrics)); setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
          <div className="relative">
            <button ref={periodProviderBtnRef} onClick={() => { setShowPeriodProviderMenu(v => !v); if (!showPeriodProviderMenu) setTempPeriodProviders(new Set(periodProviderCharts)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />选择提供商 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodProviderMenu && createPortal(
              <div data-menu="period-provider" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodProviderBtnRef.current ? periodProviderBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodProviderBtnRef.current ? Math.min(periodProviderBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodProviders.size === data.providers.length}
                    onChange={() => { if (tempPeriodProviders.size === data.providers.length) setTempPeriodProviders(new Set()); else setTempPeriodProviders(new Set(data.providers.map(p => p.name))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {data.providers.map(p => (
                  <label key={p.name} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodProviders.has(p.name)}
                      onChange={() => { const n = new Set(tempPeriodProviders); if (n.has(p.name)) n.delete(p.name); else n.add(p.name); setTempPeriodProviders(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodProviderCharts(new Set(tempPeriodProviders)); setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="space-y-6 max-h-[700px] overflow-y-auto">
          {data.providers.filter(p => periodProviderCharts.has(p.name)).slice(0, 5).map((provider) => {
            const periodData = (Object.keys(periodLabels) as PeriodType[]).map(periodKey => {
              const pData = mockPeriodData[periodKey].providers.find(p => p.name === provider.name)
              return {
                period: periodLabels[periodKey],
                totalTokens: pData?.totalTokens || 0,
                inputTokens: pData?.inputTokens || 0,
                outputTokens: pData?.outputTokens || 0,
                requests: pData?.requests || 0,
                toolCalls: pData?.toolCalls || 0,
                cost: pData?.cost || 0,
              }
            })
            return (
              <div key={provider.name}>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                  {provider.name}
                </h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => formatNumber(v)} />
                      <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip />
                      <Legend />
                      {periodChartMetrics.has('totalTokens') && <Bar yAxisId="right" dataKey="totalTokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={10} name="总token量（柱）" />}
                      {periodChartMetrics.has('inputTokens') && <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={10} name="输入量（柱）" />}
                      {periodChartMetrics.has('outputTokens') && <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={10} name="输出量（柱）" />}
                      {periodChartMetrics.has('requests') && <Bar yAxisId="count" dataKey="requests" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={10} name="请求次数（柱）" />}
                      {periodChartMetrics.has('toolCalls') && <Bar yAxisId="count" dataKey="toolCalls" fill="#06b6d4" radius={[2, 2, 0, 0]} barSize={10} name="调工具次数（柱）" />}
                      {periodChartMetrics.has('cost') && <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} name="总费用（线）" dot={{ r: 3 }} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 历史各提供商明细 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">历史各提供商消费明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">提供商</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">总 Token</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输入量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输出量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">请求次数</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">工具调用</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">网络搜索</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">价格</th>
                <th className="text-center py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">CodingPlan</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">消费金额</th>
              </tr>
            </thead>
            <tbody>
              {historyProviders.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.totalTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.inputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.outputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.requests)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.toolCalls)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.webSearch)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">
                    {editingPrice === `hist-${p.name}` ? (
                      <div className="flex items-center justify-end gap-1">
                        <input type="text" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)}
                          className="w-28 px-2 py-1 bg-white dark:bg-gray-700 border border-blue-500 rounded text-xs text-gray-900 dark:text-white focus:outline-none" autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveHistEditPrice(p.name); if (e.key === 'Escape') cancelEditPrice(); }} />
                        <button onClick={() => saveHistEditPrice(p.name)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check className="w-3 h-3" /></button>
                        <button onClick={cancelEditPrice} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingPrice(`hist-${p.name}`); setEditPriceValue(p.price); }}
                        className="text-xs text-gray-600 dark:text-gray-300 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 rounded transition-colors" title="点击编辑价格">{p.price}</button>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button onClick={() => toggleHistCodingPlan(p.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${p.codingPlan ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {p.codingPlan ? 'CodingPlan' : '按量'}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900 dark:text-white">${p.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )

  return (
    <div className="max-w-6xl space-y-6">
      {/* 周期选择 + 历史查询 */}
      <div className="flex items-center justify-between">
        {viewMode === 'period' ? (
          <div className="flex gap-2">
            {(Object.keys(periodLabels) as PeriodType[]).map((key) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${period === key ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                <Calendar className="w-3.5 h-3.5" />{periodLabels[key]}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">日期范围</span>
            <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
            <span className="text-gray-400">至</span>
            <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
            <button onClick={handleHistoryQuery}
              className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1">
              <Search className="w-3.5 h-3.5" />查询
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setViewMode('period')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'period' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            <Calendar className="w-3.5 h-3.5 inline mr-1" />周期统计
          </button>
          <button onClick={() => setViewMode('history')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            <HistoryIcon className="w-3.5 h-3.5 inline mr-1" />历史查询
          </button>
        </div>
      </div>

      {viewMode === 'period' ? renderPeriodContent() : renderHistoryContent()}
    </div>
  )
}
