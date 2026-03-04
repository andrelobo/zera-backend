import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreateTomadorDto } from './dtos/create-tomador.dto';
import { UpdateTomadorDto } from './dtos/update-tomador.dto';
import { Tomador, TomadorDocument } from './schemas/tomador.schema';

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

function nonEmpty(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

@Injectable()
export class TomadoresService {
  constructor(@InjectModel(Tomador.name) private readonly tomadorModel: Model<TomadorDocument>) {}

  async create(dto: CreateTomadorDto) {
    const empresaCnpj = onlyDigits(dto.empresaCnpj);
    const cpfCnpj = onlyDigits(dto.cpfCnpj);

    if (empresaCnpj.length !== 14) {
      throw new BadRequestException({
        code: 'TOMADOR_EMPRESA_CNPJ_INVALID',
        message: 'empresaCnpj deve conter 14 dígitos',
      });
    }

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      throw new BadRequestException({
        code: 'TOMADOR_CPF_CNPJ_INVALID',
        message: 'cpfCnpj deve conter 11 ou 14 dígitos',
      });
    }

    try {
      return await this.tomadorModel.create({
        empresaCnpj,
        cpfCnpj,
        razaoSocial: dto.razaoSocial.trim(),
        nomeFantasia: dto.nomeFantasia?.trim(),
        inscricaoMunicipal: dto.inscricaoMunicipal,
        inscricaoEstadual: dto.inscricaoEstadual,
        suframa: dto.suframa,
        substitutoTributario: dto.substitutoTributario,
        whatsapp: dto.whatsapp,
        email: dto.email?.toLowerCase().trim(),
        endereco: dto.endereco,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new BadRequestException({
          code: 'TOMADOR_ALREADY_EXISTS_FOR_EMPRESA',
          message: 'Já existe tomador com este cpfCnpj para a empresa informada',
        });
      }
      throw new BadRequestException({
        code: 'TOMADOR_CREATE_FAILED',
        message: 'Não foi possível cadastrar o tomador',
      });
    }
  }

  async list(input?: { empresaCnpj?: string; q?: string }) {
    const filter: Record<string, any> = {};

    if (input?.empresaCnpj) {
      const empresaCnpj = onlyDigits(input.empresaCnpj);
      if (empresaCnpj.length !== 14) {
        throw new BadRequestException({
          code: 'TOMADOR_EMPRESA_CNPJ_INVALID',
          message: 'empresaCnpj deve conter 14 dígitos',
        });
      }
      filter.empresaCnpj = empresaCnpj;
    }

    if (input?.q?.trim()) {
      const raw = input.q.trim();
      const digits = onlyDigits(raw);
      filter.$or = [
        { razaoSocial: { $regex: raw, $options: 'i' } },
        { cpfCnpj: { $regex: digits || raw, $options: 'i' } },
      ];
    }

    return this.tomadorModel.find(filter).sort({ createdAt: -1 });
  }

  async autocomplete(input: { empresaCnpj: string; q?: string; limit?: number }) {
    const empresaCnpj = onlyDigits(input.empresaCnpj);
    if (empresaCnpj.length !== 14) {
      throw new BadRequestException({
        code: 'TOMADOR_EMPRESA_CNPJ_INVALID',
        message: 'empresaCnpj deve conter 14 dígitos',
      });
    }

    const raw = (input.q ?? '').trim();
    const digits = onlyDigits(raw);
    const limit = Math.max(1, Math.min(Number(input.limit) || 10, 50));

    const filter: Record<string, any> = { empresaCnpj };
    if (raw) {
      const regexValue = digits || raw;
      filter.$or = [
        { razaoSocial: { $regex: raw, $options: 'i' } },
        { cpfCnpj: { $regex: regexValue, $options: 'i' } },
      ];
    }

    return this.tomadorModel
      .find(filter, {
        empresaCnpj: 1,
        cpfCnpj: 1,
        razaoSocial: 1,
        nomeFantasia: 1,
        inscricaoMunicipal: 1,
        inscricaoEstadual: 1,
        suframa: 1,
        substitutoTributario: 1,
        whatsapp: 1,
        email: 1,
        endereco: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ updatedAt: -1 })
      .limit(limit);
  }

  async getById(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({
        code: 'INVALID_TOMADOR_ID',
        message: 'id inválido',
      });
    }
    const tomador = await this.tomadorModel.findById(id);
    if (!tomador) {
      throw new NotFoundException({
        code: 'TOMADOR_NOT_FOUND',
        message: 'Tomador não encontrado',
      });
    }
    return tomador;
  }

  async update(id: string, dto: UpdateTomadorDto) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({
        code: 'INVALID_TOMADOR_ID',
        message: 'id inválido',
      });
    }

    try {
      const tomador = await this.tomadorModel.findByIdAndUpdate(
        id,
        {
          ...dto,
          razaoSocial: dto.razaoSocial?.trim(),
          nomeFantasia: dto.nomeFantasia?.trim(),
          email: dto.email?.toLowerCase().trim(),
        },
        { new: true },
      );

      if (!tomador) {
        throw new NotFoundException({
          code: 'TOMADOR_NOT_FOUND',
          message: 'Tomador não encontrado',
        });
      }
      return tomador;
    } catch (error: any) {
      if (error?.status === 404) throw error;
      throw new BadRequestException({
        code: 'TOMADOR_UPDATE_FAILED',
        message: 'Não foi possível atualizar o tomador',
      });
    }
  }

  async remove(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({
        code: 'INVALID_TOMADOR_ID',
        message: 'id inválido',
      });
    }

    const tomador = await this.tomadorModel.findByIdAndDelete(id);
    if (!tomador) {
      throw new NotFoundException({
        code: 'TOMADOR_NOT_FOUND',
        message: 'Tomador não encontrado',
      });
    }
    return { deleted: true };
  }

  async upsertFromEmission(input: {
    empresaCnpj: string;
    cpfCnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    inscricaoMunicipal?: string;
    inscricaoEstadual?: string;
    suframa?: string;
    substitutoTributario?: boolean;
    email?: string;
    whatsapp?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  }) {
    const empresaCnpj = onlyDigits(input.empresaCnpj);
    const cpfCnpj = onlyDigits(input.cpfCnpj);

    if (empresaCnpj.length !== 14) return null;
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) return null;

    const razaoSocial = nonEmpty(input.razaoSocial);
    if (!razaoSocial) return null;

    const updatePayload = {
      razaoSocial,
      nomeFantasia: nonEmpty(input.nomeFantasia),
      inscricaoMunicipal: nonEmpty(input.inscricaoMunicipal),
      inscricaoEstadual: nonEmpty(input.inscricaoEstadual),
      suframa: nonEmpty(input.suframa),
      substitutoTributario:
        typeof input.substitutoTributario === 'boolean' ? input.substitutoTributario : undefined,
      email: nonEmpty(input.email)?.toLowerCase(),
      whatsapp: nonEmpty(input.whatsapp),
      endereco: input.endereco,
    };

    return this.tomadorModel.findOneAndUpdate(
      { empresaCnpj, cpfCnpj },
      {
        $set: updatePayload,
        $setOnInsert: {
          empresaCnpj,
          cpfCnpj,
        },
      },
      { upsert: true, new: true },
    );
  }
}
