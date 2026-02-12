import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import { ApiExceptionFilter } from './api-exception.filter'

function buildHost(input?: { correlationId?: string }) {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const req = {
    correlationId: input?.correlationId,
    header: jest.fn().mockReturnValue(input?.correlationId),
  }
  const res = { status }
  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
      getNext: () => undefined,
    }),
    getArgByIndex: () => undefined,
    getArgs: () => [],
    switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined, getPattern: () => undefined }),
    getType: () => 'http',
  }

  return { host, status, json }
}

describe('ApiExceptionFilter', () => {
  it('returns standardized payload for HttpException with explicit code/details', () => {
    const filter = new ApiExceptionFilter()
    const { host, status, json } = buildHost({ correlationId: 'corr-123' })
    const exception = new BadRequestException({
      code: 'TEST_BAD_REQUEST',
      message: 'Synthetic validation error',
      details: { field: 'value' },
    })

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(json).toHaveBeenCalledWith({
      code: 'TEST_BAD_REQUEST',
      message: 'Synthetic validation error',
      correlationId: 'corr-123',
      details: { field: 'value' },
    })
  })

  it('maps unknown error to INTERNAL_ERROR and keeps correlationId', () => {
    const filter = new ApiExceptionFilter()
    const { host, status, json } = buildHost({ correlationId: 'corr-500' })

    filter.catch(new Error('boom'), host)

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(json).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      correlationId: 'corr-500',
    })
  })

  it('defaults code from status when HttpException has only message', () => {
    const filter = new ApiExceptionFilter()
    const { host, status, json } = buildHost({ correlationId: 'corr-401' })
    const exception = new HttpException('Auth failed', HttpStatus.UNAUTHORIZED)

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
    expect(json).toHaveBeenCalledWith({
      code: 'UNAUTHORIZED',
      message: 'Auth failed',
      correlationId: 'corr-401',
    })
  })
})
