import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import type { Request, Response } from 'express'

type CorrelatedRequest = Request & { correlationId?: string }

function toErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST'
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED'
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN'
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND'
    case HttpStatus.CONFLICT:
      return 'CONFLICT'
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS'
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const req = ctx.getRequest<CorrelatedRequest>()
    const res = ctx.getResponse<Response>()

    const correlationId = req.correlationId ?? req.header('x-correlation-id') ?? 'unknown'
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    let message = 'Internal server error'
    let code = toErrorCode(status)
    let details: unknown = undefined

    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any
      if (typeof response === 'string') {
        message = response
      } else if (response && typeof response === 'object') {
        message =
          typeof response.message === 'string'
            ? response.message
            : Array.isArray(response.message)
              ? response.message.join(', ')
              : exception.message
        if (typeof response.code === 'string' && response.code) {
          code = response.code
        }
        if (response.details !== undefined) {
          details = response.details
        } else if (response.provider !== undefined) {
          details = { provider: response.provider }
        } else if (response.missingFields !== undefined) {
          details = { missingFields: response.missingFields }
        }
      } else {
        message = exception.message
      }
    }

    const payload: Record<string, unknown> = {
      code,
      message,
      correlationId,
    }
    if (details !== undefined) {
      payload.details = details
    }

    res.status(status).json(payload)
  }
}
