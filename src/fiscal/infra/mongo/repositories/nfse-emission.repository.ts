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
  }): Promise<NfseEmissionDocument> {
    return this.model.create({
      provider: input.provider,
      payload: input.payload,
      status: NfseEmissionStatus.PENDING,
    })
  }

  async updateStatus(
    id: string,
    status: NfseEmissionStatus,
    providerResponse?: Record<string, any>,
  ): Promise<void> {
    await this.model.updateOne(
      { _id: id },
      { status, providerResponse },
    )
  }

  async setExternalId(
    id: string,
    externalId: string,
  ): Promise<void> {
    await this.model.updateOne(
      { _id: id },
      { externalId },
    )
  }

  async updateByExternalId(input: {
    externalId: string
    status: NfseEmissionStatus
    providerResponse?: Record<string, any>
    error?: string
  }): Promise<void> {
    await this.model.updateOne(
      { externalId: input.externalId },
      {
        status: input.status,
        providerResponse: input.providerResponse,
        error: input.error,
      },
    )
  }

  async findById(id: string): Promise<NfseEmissionDocument | null> {
    return this.model.findById(id).exec()
  }

  async findByExternalId(externalId: string): Promise<NfseEmissionDocument | null> {
    return this.model.findOne({ externalId }).exec()
  }
}
