import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { errorHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/index.js'

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy (for Traefik reverse proxy)
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}))

// Rate limiting - more generous for SPA with multiple API calls per page
app.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 200, // limit each IP to 200 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health'
  },
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// API routes
app.use('/api', apiRouter)

// Error handling
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)
})
