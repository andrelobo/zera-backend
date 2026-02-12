import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
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
    idempotencyKey?: string
    status?: NfseEmissionStatus
    externalId?: string
    providerResponse?: Record<string, any>
  }): Promise<NfseEmissionDocument> {
    const now = new Date()
    return this.model.create({
      provider: input.provider,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      status: input.status ?? NfseEmissionStatus.PENDING,
      externalId: input.externalId,
      providerResponse: input.providerResponse,
      pollAttempts: 0,
      lastPolledAt: now,
      nextPollAt: now,
    })
  }

  async updateEmission(
    id: string,
    patch: Partial<{
      provider: string
      status: NfseEmissionStatus
      externalId: string
      providerResponse: Record<string, any> | null
      providerRequest: Record<string, any> | null
      error: string | null
      xmlBase64: string | null
      pdfBase64: string | null
      pollAttempts: number
      lastPollError: string | null
      lastPolledAt: Date | null
      nextPollAt: Date | null
    }>,
  ): Promise<void> {
    const update: Record<string, any> = {}
    if (patch.provider !== undefined) update.provider = patch.provider
    if (patch.externalId !== undefined) update.externalId = patch.externalId
    if (patch.providerResponse !== undefined) update.providerResponse = patch.providerResponse
    if (patch.providerRequest !== undefined) update.providerRequest = patch.providerRequest
    if (patch.error !== undefined) update.error = patch.error
    if (patch.xmlBase64 !== undefined) update.xmlBase64 = patch.xmlBase64
    if (patch.pdfBase64 !== undefined) update.pdfBase64 = patch.pdfBase64
    if (patch.pollAttempts !== undefined) update.pollAttempts = patch.pollAttempts
    if (patch.lastPollError !== undefined) update.lastPollError = patch.lastPollError
    if (patch.lastPolledAt !== undefined) update.lastPolledAt = patch.lastPolledAt
    if (patch.nextPollAt !== undefined) update.nextPollAt = patch.nextPollAt
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
      lastPolledAt: new Date(),
    }

    if (input.xmlBase64 !== undefined) update.xmlBase64 = input.xmlBase64
    if (input.pdfBase64 !== undefined) update.pdfBase64 = input.pdfBase64

    if (input.status !== NfseEmissionStatus.PENDING) {
      update.nextPollAt = null
      update.lastPollError = null
    }

    await this.model.updateOne(filter, update)
  }

  async markPollingTransientFailure(input: {
    externalId: string
    provider?: string
    message: string
    nextPollAt: Date
  }): Promise<void> {
    const filter: Record<string, any> = {
      externalId: input.externalId,
      status: NfseEmissionStatus.PENDING,
    }

    if (input.provider) {
      filter.provider = input.provider
    }

    await this.model.updateOne(
      filter,
      {
        $inc: { pollAttempts: 1 },
        $set: {
          lastPollError: input.message,
          lastPolledAt: new Date(),
          nextPollAt: input.nextPollAt,
        },
      },
    )
  }

  async findPending(input?: {
    provider?: string
    limit?: number
    olderThanMs?: number
    now?: Date
  }): Promise<NfseEmissionDocument[]> {
    const now = input?.now ?? new Date()

    const filter: Record<string, any> = {
      status: NfseEmissionStatus.PENDING,
      $or: [{ nextPollAt: { $lte: now } }, { nextPollAt: null }, { nextPollAt: { $exists: false } }],
    }

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

  async findPaginated(input?: {
    page?: number
    limit?: number
    provider?: string
    status?: NfseEmissionStatus
  }): Promise<{
    items: NfseEmissionDocument[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const page = input?.page && input.page > 0 ? input.page : 1
    const limit = input?.limit && input.limit > 0 ? Math.min(input.limit, 100) : 20
    const skip = (page - 1) * limit

    const filter: Record<string, any> = {}
    if (input?.provider) filter.provider = input.provider
    if (input?.status) filter.status = input.status

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    }
  }

  async findById(id: string): Promise<NfseEmissionDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null
    return this.model.findById(id).exec()
  }

  async findByExternalId(externalId: string): Promise<NfseEmissionDocument | null> {
    return this.model.findOne({ externalId }).exec()
  }

  async findByIdempotencyKey(
    provider: string,
    idempotencyKey: string,
  ): Promise<NfseEmissionDocument | null> {
    return this.model.findOne({ provider, idempotencyKey }).exec()
  }

  async findByReference(provider: string, referenciaExterna: string): Promise<NfseEmissionDocument | null> {
    return this.model
      .findOne({
        provider,
        $or: [{ idempotencyKey: referenciaExterna }, { 'payload.referenciaExterna': referenciaExterna }],
      })
      .exec()
  }

  async appendArtifactSyncAudit(
    id: string,
    input: { at: Date; outcome: string; message?: string; requestedBy?: string | null; ip?: string | null },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return
    await this.model.updateOne(
      { _id: id },
      {
        $set: { lastArtifactSyncAt: input.at },
        $push: {
          artifactSyncAudit: {
            $each: [input],
            $slice: -50,
          },
        },
      },
    )
  }

  async saveArtifactsById(input: {
    id: string
    status?: NfseEmissionStatus
    providerResponse?: Record<string, any>
    xmlBase64: string
    pdfBase64: string
    error?: string | null
  }): Promise<void> {
    if (!Types.ObjectId.isValid(input.id)) return
    const update: Record<string, any> = {
      providerResponse: input.providerResponse,
      xmlBase64: input.xmlBase64,
      pdfBase64: input.pdfBase64,
      error: input.error ?? null,
      lastPolledAt: new Date(),
    }
    if (input.status) update.status = input.status
    await this.model.updateOne({ _id: input.id }, update)
  }
}
