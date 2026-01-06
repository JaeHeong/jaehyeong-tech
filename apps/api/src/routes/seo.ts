import { Router, type IRouter } from 'express'
import { getSitemap, getRssFeed, getRobotsTxt } from '../controllers/seo.js'

export const seoRouter: IRouter = Router()

// SEO endpoints - served at root level
seoRouter.get('/sitemap.xml', getSitemap)
seoRouter.get('/rss.xml', getRssFeed)
seoRouter.get('/robots.txt', getRobotsTxt)
