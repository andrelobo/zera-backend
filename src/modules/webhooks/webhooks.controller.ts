import { Body, Controller, Post } from '@nestjs/common'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status'

@Controller('webhooks/fiscal')
export class WebhooksController {
  constructor(
    private readonly repo: NfseEmissionRepository,
  ) {}

  @Post()
  async receive(@Body() body: any) {
    const externalId = body?.externalId
    const status = body?.status

    if (!externalId || !status) {
      return { received: false, reason: 'missing externalId/status' }
    }

    const mappedStatus = (status in NfseEmissionStatus)
      ? (status as NfseEmissionStatus)
      : NfseEmissionStatus.PROCESSING

    await this.repo.updateByExternalId({
      externalId,
      status: mappedStatus,
      providerResponse: body,
    })

    return { received: true }
  }
}
