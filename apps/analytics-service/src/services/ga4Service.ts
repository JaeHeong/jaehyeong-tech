import { BetaAnalyticsDataClient } from '@google-analytics/data';

// GA4 Configuration
const propertyId = process.env.GA_PROPERTY_ID;
const clientEmail = process.env.GA_CLIENT_EMAIL;
const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n');

let analyticsClient: BetaAnalyticsDataClient | null = null;

// Cache settings
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Types
export interface OverviewData {
  visitors: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  newUsers: number;
  returningUsers: number;
}

export interface DetailedAnalyticsData {
  overview: OverviewData;
  previousOverview: OverviewData | null;
  topPages: { path: string; title: string; views: number; avgTime: number }[];
  locations: { country: string; city: string; visitors: number }[];
  devices: { category: string; visitors: number }[];
  browsers: { name: string; visitors: number }[];
  trafficSources: { source: string; visitors: number }[];
  hourlyStats: { hour: number; visitors: number }[];
  dailyStats: { date: string; visitors: number; pageViews: number }[];
  updatedAt: string;
}

export interface WeeklyVisitorsData {
  daily: { date: string; visitors: number }[];
  total: number;
  updatedAt: string;
}

// Cache storage
let weeklyCache: { data: WeeklyVisitorsData; timestamp: number } | null = null;
const detailedCacheMap = new Map<string, { data: DetailedAnalyticsData; timestamp: number }>();

function getClient(): BetaAnalyticsDataClient | null {
  if (!propertyId || !clientEmail || !privateKey) {
    return null;
  }

  if (!analyticsClient) {
    analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
  }

  return analyticsClient;
}

export function isGA4Configured(): boolean {
  return !!(propertyId && clientEmail && privateKey);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] as string;
}

export async function fetchWeeklyVisitors(): Promise<WeeklyVisitorsData | null> {
  const client = getClient();
  if (!client || !propertyId) return null;

  const now = Date.now();
  if (weeklyCache && now - weeklyCache.timestamp < CACHE_TTL) {
    return weeklyCache.data;
  }

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 6);

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    const daily: { date: string; visitors: number }[] = [];
    let total = 0;

    if (response.rows) {
      for (const row of response.rows) {
        const dateStr = row.dimensionValues?.[0]?.value || '';
        const visitors = parseInt(row.metricValues?.[0]?.value || '0', 10);
        const formattedDate = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        daily.push({ date: formattedDate, visitors });
        total += visitors;
      }
    }

    // Fill missing dates
    const filledDaily: { date: string; visitors: number }[] = [];
    const currentDate = new Date(startDate);
    const endDate = new Date(today);

    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      const existing = daily.find((d) => d.date === dateStr);
      filledDaily.push({ date: dateStr, visitors: existing?.visitors || 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const data = { daily: filledDaily, total, updatedAt: new Date().toISOString() };
    weeklyCache = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error('GA4 Weekly Visitors Error:', error);
    return weeklyCache?.data || null;
  }
}

export async function fetchDetailedAnalytics(period: string): Promise<DetailedAnalyticsData | null> {
  const client = getClient();
  if (!client || !propertyId) return null;

  const now = Date.now();
  const cached = detailedCacheMap.get(period);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const today = new Date();
  let startDate: Date;
  let periodDays: number;

  switch (period) {
    case '7d':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      periodDays = 7;
      break;
    case '30d':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
      periodDays = 30;
      break;
    case 'today':
      startDate = new Date(today);
      periodDays = 1;
      break;
    case 'yesterday':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      periodDays = 1;
      break;
    default:
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      periodDays = 7;
  }

  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - periodDays + 1);

  const dateRange = {
    startDate: formatDate(startDate),
    endDate: period === 'yesterday' ? formatDate(startDate) : 'today',
  };

  const prevDateRange = {
    startDate: formatDate(prevStartDate),
    endDate: formatDate(prevEndDate),
  };

  try {
    const [overviewRes, pagesRes, locationsRes, devicesRes, browsersRes, trafficRes, hourlyRes, dailyRes] =
      await Promise.all([
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange, prevDateRange],
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'newUsers' },
          ],
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'country' }, { name: 'city' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 10,
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'browser' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 5,
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'hour' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ dimension: { dimensionName: 'hour' } }],
        }),
        client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      ]);

    // Parse overview
    const overviewRows = overviewRes[0].rows || [];
    const currentRow = overviewRows[0];
    const visitors = parseInt(currentRow?.metricValues?.[0]?.value || '0', 10);
    const newUsers = parseInt(currentRow?.metricValues?.[4]?.value || '0', 10);

    const overview: OverviewData = {
      visitors,
      pageViews: parseInt(currentRow?.metricValues?.[1]?.value || '0', 10),
      avgSessionDuration: parseFloat(currentRow?.metricValues?.[2]?.value || '0'),
      bounceRate: parseFloat(currentRow?.metricValues?.[3]?.value || '0') * 100,
      newUsers,
      returningUsers: visitors - newUsers,
    };

    let previousOverview: OverviewData | null = null;
    const previousRow = overviewRows[1];
    if (previousRow?.metricValues) {
      const prevVisitors = parseInt(previousRow.metricValues[0]?.value || '0', 10);
      const prevNewUsers = parseInt(previousRow.metricValues[4]?.value || '0', 10);
      previousOverview = {
        visitors: prevVisitors,
        pageViews: parseInt(previousRow.metricValues[1]?.value || '0', 10),
        avgSessionDuration: parseFloat(previousRow.metricValues[2]?.value || '0'),
        bounceRate: parseFloat(previousRow.metricValues[3]?.value || '0') * 100,
        newUsers: prevNewUsers,
        returningUsers: prevVisitors - prevNewUsers,
      };
    }

    const topPages = (pagesRes[0].rows || []).map((row) => ({
      path: row.dimensionValues?.[0]?.value || '',
      title: row.dimensionValues?.[1]?.value || '',
      views: parseInt(row.metricValues?.[0]?.value || '0', 10),
      avgTime: parseFloat(row.metricValues?.[1]?.value || '0'),
    }));

    const locations = (locationsRes[0].rows || []).map((row) => ({
      country: row.dimensionValues?.[0]?.value || '',
      city: row.dimensionValues?.[1]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }));

    const devices = (devicesRes[0].rows || []).map((row) => ({
      category: row.dimensionValues?.[0]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }));

    const browsers = (browsersRes[0].rows || []).map((row) => ({
      name: row.dimensionValues?.[0]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }));

    const trafficSources = (trafficRes[0].rows || []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || '',
      visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }));

    const hourlyMap = new Map<number, number>();
    for (const row of hourlyRes[0].rows || []) {
      const hour = parseInt(row.dimensionValues?.[0]?.value || '0', 10);
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);
      hourlyMap.set(hour, count);
    }
    const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      visitors: hourlyMap.get(i) || 0,
    }));

    const dailyStats = (dailyRes[0].rows || []).map((row) => {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      return {
        date: dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        visitors: parseInt(row.metricValues?.[0]?.value || '0', 10),
        pageViews: parseInt(row.metricValues?.[1]?.value || '0', 10),
      };
    });

    const data: DetailedAnalyticsData = {
      overview,
      previousOverview,
      topPages,
      locations,
      devices,
      browsers,
      trafficSources,
      hourlyStats,
      dailyStats,
      updatedAt: new Date().toISOString(),
    };

    detailedCacheMap.set(period, { data, timestamp: now });
    return data;
  } catch (error) {
    console.error('GA4 Detailed Analytics Error:', error);
    return cached?.data || null;
  }
}
