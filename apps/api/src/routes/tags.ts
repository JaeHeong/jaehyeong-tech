import { Router, type IRouter } from 'express'
import * as tagController from '../controllers/tags.js'

export const tagRouter: IRouter = Router()

tagRouter.get('/', tagController.getTags)
tagRouter.get('/:slug', tagController.getTagBySlug)
tagRouter.get('/:slug/posts', tagController.getTagPosts)
