import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { NfseEmission, NfseEmissionDocument } from '../schemas/nfse-emission.schema'
import { NfseEmissionStatus } from '../../../domain/types/nfse-emission-status'

@Injectable()
export class NfseEmissionRepository {
  constructor(
    @InjectModel(NfseEmission.name)
    private readonly model: Model<NfseEmissionDocument>,
  ) {}

  async create(input: {
    provider: string
    payload: Record<string, any>
    status?: NfseEmissionStatus
    externalId?: string
    providerResponse?: Record<string, any>
  }): Promise<NfseEmissionDocument> {
    return this.model.create({
      provider: input.provider,
      payload: input.payload,
      status: input.status ?? NfseEmissionStatus.PENDING,
      externalId: input.externalId,
      providerResponse: input.providerResponse,
    })
  }

  async updateEmission(
    id: string,
    patch: Partial<{
      provider: string
      status: NfseEmissionStatus
      externalId: string
      providerResponse: Record<string, any> | null
      error: string | null
      xmlBase64: string | null
      pdfBase64: string | null
    }>,
  ): Promise<void> {
    const update: Record<string, any> = {}
    if (patch.provider !== undefined) update.provider = patch.provider
    if (patch.externalId !== undefined) update.externalId = patch.externalId
    if (patch.providerResponse !== undefined) update.providerResponse = patch.providerResponse
    if (patch.error !== undefined) update.error = patch.error
    if (patch.xmlBase64 !== undefined) update.xmlBase64 = patch.xmlBase64
    if (patch.pdfBase64 !== undefined) update.pdfBase64 = patch.pdfBase64
    if (patch.status !== undefined) update.status = patch.status

    const hasStatus = patch.status !== undefined

    await this.model.updateOne(
      hasStatus
        ? {
            _id: id,
            $or: [
              { status: NfseEmissionStatus.PENDING },
              { status: patch.status as NfseEmissionStatus },
            ],
          }
        : { _id: id },
      update,
    )
  }

  async updateStatus(
    id: string,
    status: NfseEmissionStatus,
    providerResponse?: Record<string, any>,
  ): Promise<void> {
    await this.model.updateOne(
      {
        _id: id,
        $or: [{ status: NfseEmissionStatus.PENDING }, { status }],
      },
      { status, providerResponse },
    )
  }

  async setExternalId(id: string, externalId: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { externalId })
  }

  async updateByExternalId(input: {
    externalId: string
    status: NfseEmissionStatus
    providerResponse?: Record<string, any>
    error?: string
    provider?: string
    xmlBase64?: string
    pdfBase64?: string
  }): Promise<void> {
    const filter: Record<string, any> = {
      externalId: input.externalId,
      $or: [{ status: NfseEmissionStatus.PENDING }, { status: input.status }],
    }

    if (input.provider) {
      filter.provider = input.provider
    }

    const update: Record<string, any> = {
      status: input.status,
      providerResponse: input.providerResponse,
      error: input.error,
    }

    if (input.xmlBase64 !== undefined) update.xmlBase64 = input.xmlBase64
    if (input.pdfBase64 !== undefined) update.pdfBase64 = input.pdfBase64

    await this.model.updateOne(filter, update)
  }

  async findPending(input?: {
    provider?: string
    limit?: number
    olderThanMs?: number
  }): Promise<NfseEmissionDocument[]> {
    const filter: Record<string, any> = { status: NfseEmissionStatus.PENDING }
    if (input?.provider) filter.provider = input.provider
    if (input?.olderThanMs && input.olderThanMs > 0) {
      filter.createdAt = { $lte: new Date(Date.now() - input.olderThanMs) }
    }

    const limit = input?.limit && input.limit > 0 ? input.limit : 50

    return this.model
      .find(filter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec()
  }

  async findById(id: string): Promise<NfseEmissionDocument | null> {
    return this.model.findById(id).exec()
  }

  async findByExternalId(externalId: string): Promise<NfseEmissionDocument | null> {
    return this.model.findOne({ externalId }).exec()
  }
}
