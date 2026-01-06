import { Router, type IRouter } from 'express'
import { fetchUrlMetadata } from '../controllers/metadata.js'

export const metadataRouter: IRouter = Router()

// POST /api/metadata - Fetch URL metadata for link bookmarks
metadataRouter.post('/', fetchUrlMetadata)
