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
