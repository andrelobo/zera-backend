import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'crypto'

type CorrelatedRequest = Request & { correlationId?: string }

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const request = req as CorrelatedRequest
  const incoming = req.header('x-correlation-id')?.trim()
  const correlationId = incoming || randomUUID()

  request.correlationId = correlationId
  res.setHeader('x-correlation-id', correlationId)
  next()
}
