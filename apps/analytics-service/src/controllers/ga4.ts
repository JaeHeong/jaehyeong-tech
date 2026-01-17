import { Request, Response, NextFunction } from 'express';
import {
  isGA4Configured,
  fetchWeeklyVisitors,
  fetchDetailedAnalytics,
} from '../services/ga4Service';

/**
 * GET /api/analytics/visitors/weekly
 * 주간 방문자 통계 조회
 */
export async function getWeeklyVisitors(_req: Request, res: Response, next: NextFunction) {
  try {
    if (!isGA4Configured()) {
      return res.json({
        data: {
          daily: [],
          total: 0,
          configured: false,
        },
      });
    }

    const data = await fetchWeeklyVisitors();

    if (data) {
      return res.json({
        data: {
          ...data,
          configured: true,
        },
      });
    }

    res.json({
      data: {
        daily: [],
        total: 0,
        configured: true,
        error: 'Failed to fetch analytics data',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/detailed
 * 상세 분석 데이터 조회 (기간별)
 */
export async function getDetailedAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string) || '7d';

    if (!isGA4Configured()) {
      return res.json({
        data: null,
        configured: false,
      });
    }

    const data = await fetchDetailedAnalytics(period);

    if (data) {
      return res.json({
        data,
        configured: true,
        period,
      });
    }

    res.json({
      data: null,
      configured: true,
      error: 'Failed to fetch detailed analytics',
      period,
    });
  } catch (error) {
    next(error);
  }
}
