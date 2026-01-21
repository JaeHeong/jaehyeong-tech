import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

interface UrlMetadata {
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

// Helper to extract content from meta tags
function extractMetaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

// Resolve relative URL to absolute URL
function resolveUrl(base: string, relative: string | null): string | null {
  if (!relative) return null;
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

// Extract domain name from URL
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Validate URL
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * POST /api/metadata
 * Fetch URL metadata for link bookmarks
 */
export async function fetchUrlMetadata(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      throw new AppError('URL이 필요합니다.', 400);
    }

    if (!isValidUrl(url)) {
      throw new AppError('올바른 URL 형식이 아닙니다.', 400);
    }

    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JaehyeongTechBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AppError(`URL을 가져올 수 없습니다. (상태: ${response.status})`, 400);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new AppError('URL이 HTML 페이지가 아닙니다.', 400);
    }

    const html = await response.text();

    // Extract Open Graph metadata
    const ogTitle = extractMetaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]);

    const ogDescription = extractMetaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    ]);

    const ogImage = extractMetaContent(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ]);

    const ogSiteName = extractMetaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]);

    // Fallback to standard meta tags
    const metaTitle = extractMetaContent(html, [/<title[^>]*>([^<]+)<\/title>/i]);

    const metaDescription = extractMetaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]);

    // Extract favicon
    const faviconHref = extractMetaContent(html, [
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
    ]);

    // Build metadata response
    const metadata: UrlMetadata = {
      url,
      title: ogTitle || metaTitle || getDomain(url),
      description: ogDescription || metaDescription || '',
      image: resolveUrl(url, ogImage),
      favicon:
        resolveUrl(url, faviconHref) ||
        `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32`,
      siteName: ogSiteName || getDomain(url),
    };

    res.json({ data: metadata });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      next(new AppError('요청 시간이 초과되었습니다.', 408));
      return;
    }
    next(error);
  }
}
