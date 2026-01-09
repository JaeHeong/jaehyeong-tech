import { useState, useEffect } from 'react'
import api, { type DetailedAnalyticsData, type PageAnalyticsData } from '../services/api'

type Period = 'today' | 'yesterday' | '7d' | '30d'

const periodLabels: Record<Period, string> = {
  today: '오늘',
  yesterday: '어제',
  '7d': '7일',
  '30d': '30일',
}

// Country flag emoji mapping (GA4 country names)
const countryFlags: Record<string, string> = {
  // Asia
  'South Korea': '🇰🇷',
  'Korea': '🇰🇷',
  'Republic of Korea': '🇰🇷',
  'Japan': '🇯🇵',
  'China': '🇨🇳',
  'Taiwan': '🇹🇼',
  'Hong Kong': '🇭🇰',
  'Macau': '🇲🇴',
  'Mongolia': '🇲🇳',
  'India': '🇮🇳',
  'Singapore': '🇸🇬',
  'Vietnam': '🇻🇳',
  'Viet Nam': '🇻🇳',
  'Thailand': '🇹🇭',
  'Indonesia': '🇮🇩',
  'Philippines': '🇵🇭',
  'Malaysia': '🇲🇾',
  'Myanmar': '🇲🇲',
  'Myanmar (Burma)': '🇲🇲',
  'Cambodia': '🇰🇭',
  'Laos': '🇱🇦',
  'Bangladesh': '🇧🇩',
  'Pakistan': '🇵🇰',
  'Sri Lanka': '🇱🇰',
  'Nepal': '🇳🇵',
  'Kazakhstan': '🇰🇿',
  'Uzbekistan': '🇺🇿',

  // North America
  'United States': '🇺🇸',
  'USA': '🇺🇸',
  'Canada': '🇨🇦',
  'Mexico': '🇲🇽',

  // Europe
  'United Kingdom': '🇬🇧',
  'UK': '🇬🇧',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Italy': '🇮🇹',
  'Spain': '🇪🇸',
  'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪',
  'Switzerland': '🇨🇭',
  'Austria': '🇦🇹',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Finland': '🇫🇮',
  'Poland': '🇵🇱',
  'Czechia': '🇨🇿',
  'Czech Republic': '🇨🇿',
  'Portugal': '🇵🇹',
  'Ireland': '🇮🇪',
  'Greece': '🇬🇷',
  'Hungary': '🇭🇺',
  'Romania': '🇷🇴',
  'Ukraine': '🇺🇦',
  'Russia': '🇷🇺',
  'Russian Federation': '🇷🇺',
  'Turkey': '🇹🇷',
  'Türkiye': '🇹🇷',

  // Oceania
  'Australia': '🇦🇺',
  'New Zealand': '🇳🇿',

  // South America
  'Brazil': '🇧🇷',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'Colombia': '🇨🇴',
  'Peru': '🇵🇪',

  // Middle East
  'Israel': '🇮🇱',
  'United Arab Emirates': '🇦🇪',
  'UAE': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Qatar': '🇶🇦',
  'Kuwait': '🇰🇼',
  'Iran': '🇮🇷',
  'Iraq': '🇮🇶',
  'Egypt': '🇪🇬',

  // Africa
  'South Africa': '🇿🇦',
  'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪',
  'Morocco': '🇲🇦',

  // Special
  '(not set)': '🌐',
}

// Traffic source icons
const sourceIcons: Record<string, string> = {
  'Direct': 'link',
  'Organic Search': 'search',
  'Organic Social': 'share',
  'Referral': 'open_in_new',
  'Email': 'mail',
  'Paid Search': 'paid',
  'Paid Social': 'campaign',
  'Display': 'ad_units',
  'Unassigned': 'help',
}

// Traffic source Korean names (short for mobile)
const sourceNamesShort: Record<string, string> = {
  'Direct': '직접 유입',
  'Organic Search': '자연 검색',
  'Organic Social': '소셜 미디어',
  'Referral': '외부 링크',
  'Email': '이메일',
  'Paid Search': '검색 광고',
  'Paid Social': '소셜 광고',
  'Display': '디스플레이 광고',
  'Unassigned': '기타',
}

// Traffic source Korean names (long for desktop)
const sourceNamesLong: Record<string, string> = {
  'Direct': '직접 URL 입력 또는 북마크',
  'Organic Search': 'Google, Naver 등 검색 엔진',
  'Organic Social': 'Facebook, Twitter 등 소셜 미디어',
  'Referral': '다른 웹사이트에서 링크 클릭',
  'Email': '이메일 링크',
  'Paid Search': '검색 광고 (Google Ads 등)',
  'Paid Social': '소셜 미디어 광고',
  'Display': '디스플레이 광고',
  'Unassigned': '분류되지 않은 트래픽',
}

// Device icons
const deviceIcons: Record<string, string> = {
  desktop: 'computer',
  mobile: 'smartphone',
  tablet: 'tablet',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}초`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}분 ${secs}초`
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function ChangeIndicator({ current, previous, inverted = false }: { current: number; previous: number; inverted?: boolean }) {
  const change = calculateChange(current, previous)
  if (change === null) return null

  const isPositive = inverted ? change < 0 : change > 0
  const isNegative = inverted ? change > 0 : change < 0

  return (
    <span className={`inline-flex items-center text-[9px] md:text-xs font-medium ${
      isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-slate-400'
    }`}>
      {change > 0 ? (
        <span className="material-symbols-outlined text-[12px] md:text-[14px]">arrow_upward</span>
      ) : change < 0 ? (
        <span className="material-symbols-outlined text-[12px] md:text-[14px]">arrow_downward</span>
      ) : null}
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

// Page Analytics Modal Component
function PageAnalyticsModal({
  data,
  isLoading,
  error,
  onClose
}: {
  data: PageAnalyticsData | null
  isLoading: boolean
  error: string | null
  onClose: () => void
}) {
  const totalDeviceVisitors = data?.devices.reduce((sum, d) => sum + d.visitors, 0) || 0
  const totalSourceVisitors = data?.trafficSources.reduce((sum, s) => sum + s.visitors, 0) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-base md:text-lg font-bold truncate">
              {isLoading ? '로딩 중...' : data?.pageTitle || '페이지 분석'}
            </h2>
            {data && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{data.pagePath}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-70px)]">
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                progress_activity
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {data && !isLoading && !error && (
            <div className="space-y-4">
              {/* Overview Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] md:text-xs text-slate-500 mb-1">조회수</p>
                  <p className="text-lg md:text-xl font-bold">{data.totalViews.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] md:text-xs text-slate-500 mb-1">방문자</p>
                  <p className="text-lg md:text-xl font-bold">{data.totalVisitors.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] md:text-xs text-slate-500 mb-1">평균 체류</p>
                  <p className="text-lg md:text-xl font-bold">{formatDuration(data.avgSessionDuration)}</p>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Locations */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">location_on</span>
                    <h3 className="text-xs font-bold">지역별 방문자</h3>
                  </div>
                  {data.locations.length > 0 ? (
                    <div className="space-y-1.5">
                      {data.locations.slice(0, 5).map((loc, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span>
                            {countryFlags[loc.country] || '🌐'} {loc.country}
                            {loc.city && loc.city !== '(not set)' && (
                              <span className="text-slate-400 ml-1">({loc.city})</span>
                            )}
                          </span>
                          <span className="font-medium">{loc.visitors}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">데이터 없음</p>
                  )}
                </div>

                {/* Devices */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">devices</span>
                    <h3 className="text-xs font-bold">기기별 분포</h3>
                  </div>
                  {data.devices.length > 0 ? (
                    <div className="space-y-2">
                      {data.devices.map((device, i) => {
                        const percent = totalDeviceVisitors > 0 ? (device.visitors / totalDeviceVisitors) * 100 : 0
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">
                                  {deviceIcons[device.category.toLowerCase()] || 'devices'}
                                </span>
                                <span className="capitalize">{device.category}</span>
                              </span>
                              <span className="font-medium">{percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">데이터 없음</p>
                  )}
                </div>

                {/* Traffic Sources */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">call_split</span>
                    <h3 className="text-xs font-bold">유입 경로</h3>
                  </div>
                  {data.trafficSources.length > 0 ? (
                    <div className="space-y-2">
                      {data.trafficSources.map((source, i) => {
                        const percent = totalSourceVisitors > 0 ? (source.visitors / totalSourceVisitors) * 100 : 0
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">
                                  {sourceIcons[source.source] || 'link'}
                                </span>
                                <span>{sourceNamesShort[source.source] || source.source}</span>
                              </span>
                              <span className="font-medium">{percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">데이터 없음</p>
                  )}
                </div>

                {/* Referrers */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">link</span>
                    <h3 className="text-xs font-bold">유입 소스</h3>
                  </div>
                  {data.referrers.length > 0 ? (
                    <div className="space-y-1.5">
                      {data.referrers.slice(0, 5).map((ref, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[150px]">{ref.referrer || '(direct)'}</span>
                          <span className="font-medium">{ref.visitors}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">데이터 없음</p>
                  )}
                </div>
              </div>

              {/* Browsers */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">web</span>
                  <h3 className="text-xs font-bold">브라우저</h3>
                </div>
                {data.browsers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.browsers.map((browser, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-full text-xs">
                        {browser.name} <span className="font-medium">{browser.visitors}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">데이터 없음</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<DetailedAnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Page analytics modal state
  const [selectedPage, setSelectedPage] = useState<string | null>(null)
  const [pageAnalytics, setPageAnalytics] = useState<PageAnalyticsData | null>(null)
  const [pageAnalyticsLoading, setPageAnalyticsLoading] = useState(false)
  const [pageAnalyticsError, setPageAnalyticsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.getDetailedAnalytics(period)
        if (response.data) {
          setData(response.data)
          setLastUpdated(response.data.updatedAt)
        } else if (response.error) {
          setError(response.error)
        } else if (!response.configured) {
          setError('Google Analytics가 설정되지 않았습니다.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [period])

  // Fetch page analytics when a page is selected
  useEffect(() => {
    if (!selectedPage) return

    const fetchPageAnalytics = async () => {
      setPageAnalyticsLoading(true)
      setPageAnalyticsError(null)
      setPageAnalytics(null)
      try {
        const response = await api.getPageAnalytics(selectedPage, period)
        if (response.data) {
          setPageAnalytics(response.data)
        } else if (response.error) {
          setPageAnalyticsError(response.error)
        }
      } catch (err) {
        setPageAnalyticsError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.')
      } finally {
        setPageAnalyticsLoading(false)
      }
    }

    fetchPageAnalytics()
  }, [selectedPage, period])

  const handlePageClick = (path: string) => {
    setSelectedPage(path)
  }

  const handleCloseModal = () => {
    setSelectedPage(null)
    setPageAnalytics(null)
    setPageAnalyticsError(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <span className="material-symbols-outlined">error</span>
          <span className="font-medium">{error}</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">analytics</span>
        <p className="text-slate-500">데이터가 없습니다.</p>
      </div>
    )
  }

  const totalDeviceVisitors = data.devices.reduce((sum, d) => sum + d.visitors, 0)
  const totalSourceVisitors = data.trafficSources.reduce((sum, s) => sum + s.visitors, 0)
  const maxHourlyVisitors = Math.max(...data.hourlyStats.map((h) => h.visitors), 1)

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-2xl font-bold">보고서 개요</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Google Analytics 데이터 기반 블로그 분석
          </p>
        </div>
        {lastUpdated && (
          <div className="text-[10px] md:text-xs text-slate-400">
            마지막 업데이트: {new Date(lastUpdated).toLocaleString('ko-KR')}
          </div>
        )}
      </div>

      {/* Period Selector */}
      <div className="flex gap-1.5 md:gap-2 mb-4 md:mb-6">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              period === p
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-sm text-slate-500">방문자</span>
            <div className="p-1 md:p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">group</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <p className="text-xl md:text-3xl font-bold">{formatNumber(data.overview.visitors)}</p>
            {data.previousOverview && (
              <ChangeIndicator current={data.overview.visitors} previous={data.previousOverview.visitors} />
            )}
          </div>
          <p className="text-[9px] md:text-xs text-slate-400 mt-1">
            신규 {data.overview.newUsers} / 재방문 {data.overview.returningUsers}
          </p>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-sm text-slate-500">페이지뷰</span>
            <div className="p-1 md:p-1.5 bg-green-500/10 rounded-lg text-green-500">
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">visibility</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <p className="text-xl md:text-3xl font-bold">{formatNumber(data.overview.pageViews)}</p>
            {data.previousOverview && (
              <ChangeIndicator current={data.overview.pageViews} previous={data.previousOverview.pageViews} />
            )}
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-sm text-slate-500">평균 체류</span>
            <div className="p-1 md:p-1.5 bg-purple-500/10 rounded-lg text-purple-500">
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">schedule</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <p className="text-xl md:text-3xl font-bold">{formatDuration(data.overview.avgSessionDuration)}</p>
            {data.previousOverview && (
              <ChangeIndicator current={data.overview.avgSessionDuration} previous={data.previousOverview.avgSessionDuration} />
            )}
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl p-3 md:p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-sm text-slate-500">이탈률</span>
            <div className="p-1 md:p-1.5 bg-orange-500/10 rounded-lg text-orange-500">
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">exit_to_app</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <p className="text-xl md:text-3xl font-bold">{data.overview.bounceRate.toFixed(1)}%</p>
            {data.previousOverview && (
              <ChangeIndicator current={data.overview.bounceRate} previous={data.previousOverview.bounceRate} inverted />
            )}
          </div>
        </div>
      </div>

      {/* 2-Column: Locations + Devices/Browsers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Locations */}
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-500">location_on</span>
              <h3 className="text-sm md:text-base font-bold">지역별 방문자</h3>
            </div>
          </div>
          <div className="p-3 md:p-6">
            {data.locations.length > 0 ? (
              <div className="space-y-2 md:space-y-3">
                {data.locations.map((loc, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="text-base md:text-lg">{countryFlags[loc.country] || '🌐'}</span>
                      <span className="text-xs md:text-sm">
                        {loc.country}
                        {loc.city && loc.city !== '(not set)' && (
                          <span className="text-slate-400 ml-1">({loc.city})</span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs md:text-sm font-bold">{loc.visitors}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-400 py-4 text-xs md:text-sm">데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* Devices & Browsers */}
        <div className="space-y-4 md:space-y-6">
          {/* Devices */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-500">devices</span>
                <h3 className="text-sm md:text-base font-bold">기기별 분포</h3>
              </div>
            </div>
            <div className="p-3 md:p-4">
              {data.devices.length > 0 ? (
                <div className="space-y-2 md:space-y-3">
                  {data.devices.map((device, index) => {
                    const percent = totalDeviceVisitors > 0 ? (device.visitors / totalDeviceVisitors) * 100 : 0
                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="material-symbols-outlined text-[16px] md:text-[18px] text-slate-400">
                              {deviceIcons[device.category.toLowerCase()] || 'devices'}
                            </span>
                            <span className="text-xs md:text-sm capitalize">{device.category}</span>
                          </div>
                          <span className="text-xs md:text-sm font-bold">{percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 md:h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4 text-xs md:text-sm">데이터가 없습니다.</p>
              )}
            </div>
          </div>

          {/* Browsers */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-500">web</span>
                <h3 className="text-sm md:text-base font-bold">브라우저</h3>
              </div>
            </div>
            <div className="p-3 md:p-4">
              {data.browsers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {data.browsers.map((browser, index) => (
                    <span
                      key={index}
                      className="px-2 md:px-3 py-1 md:py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs md:text-sm"
                    >
                      {browser.name} <span className="font-bold">{browser.visitors}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4 text-xs md:text-sm">데이터가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Pages */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-500">article</span>
            <h3 className="text-sm md:text-base font-bold">인기 페이지 Top 10</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          {data.topPages.length > 0 ? (
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] md:text-xs uppercase">
                <tr>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left w-8 md:w-12">#</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left">제목</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left">경로</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-right w-14 md:w-20">조회수</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-right hidden lg:table-cell w-24">평균 체류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.topPages.map((page, index) => (
                  <tr
                    key={index}
                    onClick={() => handlePageClick(page.path)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-2 md:px-4 py-2 md:py-3">
                      <span className={`font-bold ${index < 3 ? 'text-primary' : 'text-slate-400'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3">
                      <p className="font-medium truncate max-w-[80px] md:max-w-[200px] lg:max-w-[300px]">
                        {page.title || '(제목 없음)'}
                      </p>
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(page.path, '_blank')
                        }}
                        className="text-[10px] md:text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 md:px-2 py-0.5 md:py-1 rounded truncate block max-w-[80px] md:max-w-[150px] lg:max-w-[250px] hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        {page.path}
                      </button>
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right font-bold">{page.views.toLocaleString()}</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right text-slate-500 hidden lg:table-cell">
                      {formatDuration(page.avgTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 md:p-8 text-center text-slate-400 text-xs md:text-sm">데이터가 없습니다.</div>
          )}
        </div>
      </div>

      {/* Hourly Stats */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-500">schedule</span>
            <h3 className="text-sm md:text-base font-bold">시간대별 방문자</h3>
          </div>
        </div>
        <div className="p-3 md:p-6">
          <div className="flex items-end justify-between gap-0.5 md:gap-1 h-24 md:h-32">
            {data.hourlyStats.map((hour) => {
              const heightPercent = maxHourlyVisitors > 0 ? (hour.visitors / maxHourlyVisitors) * 100 : 0
              const isPeakHour = hour.visitors === maxHourlyVisitors && hour.visitors > 0
              return (
                <div key={hour.hour} className="flex-1 flex flex-col items-center gap-0.5 md:gap-1 group">
                  <span className="text-[6px] md:text-[8px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {hour.visitors}
                  </span>
                  <div className="w-full flex items-end justify-center h-16 md:h-20">
                    <div
                      className={`w-full max-w-[10px] md:max-w-[16px] rounded-t transition-all ${
                        isPeakHour ? 'bg-primary' : 'bg-primary/50'
                      }`}
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                      title={`${hour.hour}시: ${hour.visitors}명`}
                    />
                  </div>
                  <span className={`text-[8px] md:text-[10px] h-3 md:h-4 ${hour.hour % 6 === 0 ? 'text-slate-500' : 'text-transparent'}`}>
                    {hour.hour % 6 === 0 ? `${hour.hour}시` : '\u00A0'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Traffic Sources */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-3 md:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] md:text-[24px] text-slate-500">call_split</span>
            <h3 className="text-sm md:text-base font-bold">유입 경로</h3>
          </div>
        </div>
        <div className="p-3 md:p-6">
          {data.trafficSources.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {data.trafficSources.map((source, index) => {
                const percent = totalSourceVisitors > 0 ? (source.visitors / totalSourceVisitors) * 100 : 0
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="material-symbols-outlined text-[16px] md:text-[18px] text-slate-400">
                          {sourceIcons[source.source] || 'link'}
                        </span>
                        <span className="text-xs md:text-sm font-medium">
                          <span className="md:hidden">{sourceNamesShort[source.source] || source.source}</span>
                          <span className="hidden md:inline">{sourceNamesLong[source.source] || source.source}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-xs md:text-sm text-slate-500">{source.visitors}명</span>
                        <span className="text-xs md:text-sm font-bold w-10 md:w-12 text-right">{percent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 md:h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-4 text-xs md:text-sm">데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* Page Analytics Modal */}
      {selectedPage && (
        <PageAnalyticsModal
          data={pageAnalytics}
          isLoading={pageAnalyticsLoading}
          error={pageAnalyticsError}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
