import { Injectable } from '@nestjs/common'

@Injectable()
export class UpdateStatusService {
  async execute(externalId: string, status: string, raw: any) {
    return {
      externalId,
      status,
      processedAt: new Date().toISOString()
    }
  }
}
