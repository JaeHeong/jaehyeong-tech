import type { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { AppError } from '../middleware/errorHandler.js'

type ValidationTarget = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[target]
      const result = schema.parse(data)

      // Replace with validated and transformed data
      if (target === 'body') {
        req.body = result
      } else if (target === 'query') {
        // Keep original query but add validated data
        Object.assign(req.query, result)
      } else if (target === 'params') {
        Object.assign(req.params, result)
      }

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => e.message).join(', ')
        next(new AppError(messages, 400))
      } else {
        next(error)
      }
    }
  }
}

// Convenience functions
export const validateBody = (schema: ZodSchema) => validate(schema, 'body')
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query')
export const validateParams = (schema: ZodSchema) => validate(schema, 'params')
