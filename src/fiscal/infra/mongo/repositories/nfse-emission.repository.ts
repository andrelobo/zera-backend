import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NfseEmission, NfseEmissionDocument } from '../schemas/nfse-emission.schema';

@Injectable()
export class NfseEmissionRepository {
  constructor(
    @InjectModel(NfseEmission.name) private readonly model: Model<NfseEmissionDocument>,
  ) {}

  async create(data: Partial<NfseEmission>): Promise<NfseEmission> {
    return this.model.create(data);
  }

  async findById(id: string): Promise<NfseEmission | null> {
    return this.model.findById(id).exec();
  }

  async updateStatus(id: string, status: string): Promise<NfseEmission | null> {
    return this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  async findAll(): Promise<NfseEmission[]> {
    return this.model.find().exec();
  }
}
