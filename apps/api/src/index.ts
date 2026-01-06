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

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}))

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
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
