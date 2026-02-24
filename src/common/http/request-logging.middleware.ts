import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type CorrelatedRequest = Request & { correlationId?: string };

const logger = new Logger('HttpRequest');

function toSafeNumber(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const request = req as CorrelatedRequest;
  const startedAt = Date.now();
  const { method } = req;
  const path = req.originalUrl || req.url;
  const correlationId = request.correlationId ?? req.header('x-correlation-id') ?? 'unknown';
  const ip = req.ip;
  const userAgent = req.header('user-agent') ?? '-';
  const reqContentLength = toSafeNumber(req.header('content-length'));

  logger.log(
    JSON.stringify({
      event: 'request_started',
      method,
      path,
      correlationId,
      ip,
      userAgent,
      reqContentLength,
    }),
  );

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const statusCode = res.statusCode;
    const resContentLength = toSafeNumber(res.getHeader('content-length'));
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
    const payload = JSON.stringify({
      event: 'request_finished',
      method,
      path,
      correlationId,
      statusCode,
      durationMs,
      reqContentLength,
      resContentLength,
      ip,
    });

    if (level === 'error') {
      logger.error(payload);
      return;
    }
    if (level === 'warn') {
      logger.warn(payload);
      return;
    }
    logger.log(payload);
  });

  next();
}
