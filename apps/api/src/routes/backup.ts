import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  deleteBackup,
} from '../controllers/backup.js'

const router: IRouter = Router()

// All routes require authentication
router.use(authenticate)

// Backup routes
router.post('/', createBackup)
router.get('/', listBackups)
router.get('/:fileName', downloadBackup)
router.post('/:fileName/restore', restoreBackup)
router.delete('/:fileName', deleteBackup)

export { router as backupRouter }
