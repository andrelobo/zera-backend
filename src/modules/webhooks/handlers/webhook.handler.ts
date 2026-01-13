import { Injectable } from '@nestjs/common'
import { UpdateStatusService } from '../services/update-status.service'

@Injectable()
export class WebhookHandler {
  constructor(private readonly updateStatus: UpdateStatusService) {}

  async handle(payload: any, headers: any) {
    const { externalId, status } = payload
    return this.updateStatus.execute(externalId, status, payload)
  }
}
