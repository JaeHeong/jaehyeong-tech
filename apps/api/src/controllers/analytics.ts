import type { Request, Response } from 'express'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

const propertyId = process.env.GA_PROPERTY_ID
const clientEmail = process.env.GA_CLIENT_EMAIL
const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n')

let analyticsClient: BetaAnalyticsDataClient | null = null

// Cache settings
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds
let cachedData: {
  daily: { date: string; visitors: number }[]
  total: number
  updatedAt: string
} | null = null
let cacheTimestamp = 0

// Detailed analytics cache
interface DetailedAnalyticsData {
  overview: {
    visitors: number
    pageViews: number
    avgSessionDuration: number
    bounceRate: number
    newUsers: number
    returningUsers: number
  }
  topPages: { path: string; title: string; views: number; avgTime: number }[]
  locations: { country: string; city: string; visitors: number }[]
  devices: { category: string; visitors: number }[]
  browsers: { name: string; visitors: number }[]
  trafficSources: { source: string; visitors: number }[]
  hourlyStats: { hour: number; visitors: number }[]
  dailyStats: { date: string; visitors: number; pageViews: number }[]
  updatedAt: string
}
let cachedDetailedData: DetailedAnalyticsData | null = null
let detailedCacheTimestamp = 0

function getClient(): BetaAnalyticsDataClient | null {
  if (!propertyId || !clientEmail || !privateKey) {
    return null
  }

  if (!analyticsClient) {
    analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    })
  }

  return analyticsClient
}

async function fetchAnalyticsData() {
  const client = getClient()

  if (!client || !propertyId) {
    return null
  }

  // Get data for last 7 days including today
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 6) // 7 days including today

  const formatDate = (date: Date): string => date.toISOString().split('T')[0] as string

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: formatDate(startDate),
        endDate: 'today',
      },
    ],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  })

  const daily: { date: string; visitors: number }[] = []
  let total = 0

  if (response.rows) {
    for (const row of response.rows) {
      const dateStr = row.dimensionValues?.[0]?.value || ''
      const visitors = parseInt(row.metricValues?.[0]?.value || '0', 10)

      // Convert YYYYMMDD to YYYY-MM-DD
      const formattedDate = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')

      daily.push({
        date: formattedDate,
        visitors,
      })
      total += visitors
    }
  }

  // Fill in missing dates with 0 visitors
  const filledDaily: { date: string; visitors: number }[] = []
  const currentDate = new Date(startDate)
  const endDate = new Date(today)

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate)
    const existing = daily.find((d) => d.date === dateStr)
    filledDaily.push({
      date: dateStr,
      visitors: existing?.visitors || 0,
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return {
    daily: filledDaily,
    total,
    updatedAt: new Date().toISOString(),
  }
}

async function fetchDetailedAnalytics(period: string): Promise<DetailedAnalyticsData | null> {
  const client = getClient()
  if (!client || !propertyId) return null

  const formatDate = (date: Date): string => date.toISOString().split('T')[0] as string
  const today = new Date()
  let startDate: Date

  switch (period) {
    case '7d':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 6)
      break
    case '30d':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 29)
      break
    case 'today':
      startDate = new Date(today)
      break
    case 'yesterday':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 1)
      break
    default:
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 6)
  }

  const dateRange = {
    startDate: formatDate(startDate),
    endDate: period === 'yesterday' ? formatDate(startDate) : 'today',
  }

  try {
    // Run multiple reports in parallel
    const [overviewRes, pagesRes, locationsRes, devicesRes, browsersRes, trafficRes, hourlyRes, dailyRes] = await Promise.all([
      // Overview metrics
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'newUsers' },
        ],
      }),
      // Top pages
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      // Locations
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
      // Devices
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),
      // Browsers
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'browser' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 5,
      }),
      // Traffic sources
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),
      // Hourly stats
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'hour' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'hour' } }],
      }),
      // Daily stats
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    ])

    // Parse overview
    const overviewRow = overviewRes[0].rows?.[0]
    const visitors = parseInt(overviewRow?.metricValues?.[0]?.value || '0', 10)
    const newUsers = parseInt(overviewRow?.metricValues?.[4]?.value || '0', 10)
    const overview = {
      visitors,
      pageViews: parseInt(overviewRow?.metricValues?.[1]?.value || '0', 10),
      avgSessionDuration: parseFloat(overviewRow?.metricValues?.[2]?.value || '0'),
      bounceRate: parseFloat(overviewRow?.metricValues?.[3]?.value || '0') * 100,
      newUsers,
      returningUsers: visitors - newUsers,
    }

    // Parse top pages
    const topPages = (pagesRes[0].rows || []).map((row) => ({
      path: row.dimensionValues?.[0]?.value || '',
      title: row.dimensionValues?.[1]?.value || '',
      views: parseInt(row.metricValues?.[0]?.value || '0', 10),
      avgTime: parseFloat(row.metricValues?.[1]?.value || '0'),
    }))

    // Parse locations
    const locations = (locationsRes[0].rows || []).map((row) => ({
      country: row.dimensionValues?.[0]?.value || '',
      city: row.dimensionValues?.[1]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }))

    // Parse devices
    const devices = (devicesRes[0].rows || []).map((row) => ({
      category: row.dimensionValues?.[0]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }))

    // Parse browsers
    const browsers = (browsersRes[0].rows || []).map((row) => ({
      name: row.dimensionValues?.[0]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }))

    // Parse traffic sources
    const trafficSources = (trafficRes[0].rows || []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }))

    // Parse hourly stats (fill missing hours with 0)
    const hourlyMap = new Map<number, number>()
    for (const row of hourlyRes[0].rows || []) {
      const hour = parseInt(row.dimensionValues?.[0]?.value || '0', 10)
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10)
      hourlyMap.set(hour, count)
    }
    const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      visitors: hourlyMap.get(i) || 0,
    }))

    // Parse daily stats
    const dailyStats = (dailyRes[0].rows || []).map((row) => {
      const dateStr = row.dimensionValues?.[0]?.value || ''
      return {
        date: dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
        pageViews: parseInt(row.metricValues?.[1]?.value || '0', 10),
      }
    })

    return {
      overview,
      topPages,
      locations,
      devices,
      browsers,
      trafficSources,
      hourlyStats,
      dailyStats,
      updatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('GA4 Detailed Analytics Error:', error)
    return null
  }
}

export async function getDetailedAnalytics(req: Request, res: Response) {
  try {
    const client = getClient()
    const period = (req.query.period as string) || '7d'

    if (!client || !propertyId) {
      return res.json({
        data: null,
        configured: false,
      })
    }

    const now = Date.now()

    // Check cache (use same cache for same period)
    if (cachedDetailedData && now - detailedCacheTimestamp < CACHE_TTL) {
      return res.json({
        data: cachedDetailedData,
        configured: true,
        cached: true,
        period,
      })
    }

    const data = await fetchDetailedAnalytics(period)

    if (data) {
      cachedDetailedData = data
      detailedCacheTimestamp = now

      return res.json({
        data,
        configured: true,
        cached: false,
        period,
      })
    }

    // Fallback to cache
    if (cachedDetailedData) {
      return res.json({
        data: cachedDetailedData,
        configured: true,
        cached: true,
        stale: true,
        period,
      })
    }

    res.json({
      data: null,
      configured: true,
      error: 'Failed to fetch detailed analytics',
      period,
    })
  } catch (error) {
    console.error('GA4 Detailed API Error:', error)

    if (cachedDetailedData) {
      return res.json({
        data: cachedDetailedData,
        configured: true,
        cached: true,
        stale: true,
      })
    }

    res.json({
      data: null,
      configured: true,
      error: 'Failed to fetch detailed analytics',
    })
  }
}

export async function getWeeklyVisitors(_req: Request, res: Response) {
  try {
    const client = getClient()

    if (!client || !propertyId) {
      // GA not configured - return empty data
      return res.json({
        data: {
          daily: [],
          total: 0,
          configured: false,
        },
      })
    }

    const now = Date.now()

    // Check if cache is valid
    if (cachedData && now - cacheTimestamp < CACHE_TTL) {
      return res.json({
        data: {
          ...cachedData,
          configured: true,
          cached: true,
        },
      })
    }

    // Fetch fresh data
    const data = await fetchAnalyticsData()

    if (data) {
      cachedData = data
      cacheTimestamp = now

      return res.json({
        data: {
          ...data,
          configured: true,
          cached: false,
        },
      })
    }

    // Fallback to cached data if fetch failed but cache exists
    if (cachedData) {
      return res.json({
        data: {
          ...cachedData,
          configured: true,
          cached: true,
          stale: true,
        },
      })
    }

    res.json({
      data: {
        daily: [],
        total: 0,
        configured: true,
        error: 'Failed to fetch analytics data',
      },
    })
  } catch (error) {
    console.error('GA4 API Error:', error)

    // Return cached data on error if available
    if (cachedData) {
      return res.json({
        data: {
          ...cachedData,
          configured: true,
          cached: true,
          stale: true,
        },
      })
    }

    res.json({
      data: {
        daily: [],
        total: 0,
        configured: true,
        error: 'Failed to fetch analytics data',
      },
    })
  }
}
