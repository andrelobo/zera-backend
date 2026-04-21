import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreateTomadorDto } from './dtos/create-tomador.dto';
import { UpdateTomadorDto } from './dtos/update-tomador.dto';
import { HubdevCpfApi } from './hubdev-cpf.api';
import { Tomador, TomadorDocument, type TomadorOrigemCadastro } from './schemas/tomador.schema';

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

function isCpf(value?: string): boolean {
  return onlyDigits(value).length === 11;
}

function nonEmpty(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

type TomadorServicoInput = {
  codigoServico?: string;
  descricaoServico?: string;
};

function normalizeTomadorServicos(input?: TomadorServicoInput[]) {
  if (!Array.isArray(input)) return [];
  const now = new Date();
  const unique = new Map<
    string,
    { codigoServico: string; descricaoServico: string; updatedAt: Date }
  >();
  for (const item of input) {
    const codigoServico = nonEmpty(item?.codigoServico)?.replace(/\D/g, '').slice(0, 6);
    const descricaoServico = nonEmpty(item?.descricaoServico);
    if (!codigoServico || !descricaoServico) continue;
    unique.set(codigoServico, { codigoServico, descricaoServico, updatedAt: now });
    if (unique.size >= 20) break;
  }
  return Array.from(unique.values());
}

@Injectable()
export class TomadoresService {
  constructor(
    @InjectModel(Tomador.name) private readonly tomadorModel: Model<TomadorDocument>,
    private readonly hubdevCpfApi: HubdevCpfApi,
  ) {}

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
        substitutoTributario: isCpf(cpfCnpj) ? false : dto.substitutoTributario,
        whatsapp: dto.whatsapp,
        email: dto.email?.toLowerCase().trim(),
        endereco: dto.endereco,
        origemCadastro: 'manual',
        servicos: normalizeTomadorServicos(dto.servicos),
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
        servicos: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ updatedAt: -1 })
      .limit(limit);
  }

  async lookupCpf(input: { cpf: string }) {
    const cpf = onlyDigits(input.cpf);
    if (cpf.length !== 11) {
      throw new BadRequestException({
        code: 'TOMADOR_CPF_INVALID',
        message: 'cpf deve conter 11 dígitos',
      });
    }

    try {
      const raw = await this.hubdevCpfApi.consultarCpf(cpf);
      return this.normalizeCpfLookup(cpf, raw);
    } catch (error: any) {
      if (error?.status === 503 || error?.response?.statusCode === 503) throw error;
      if (error?.status === 400 || error?.response?.statusCode === 400) throw error;
      throw new BadGatewayException({
        code: 'TOMADOR_CPF_LOOKUP_FAILED',
        message: 'Não foi possível consultar o CPF na fonte externa.',
      });
    }
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
      const existing = await this.tomadorModel.findById(id).lean();
      if (!existing) {
        throw new NotFoundException({
          code: 'TOMADOR_NOT_FOUND',
          message: 'Tomador não encontrado',
        });
      }

      const updatePayload = {
        ...dto,
        razaoSocial: dto.razaoSocial?.trim(),
        nomeFantasia: dto.nomeFantasia?.trim(),
        email: dto.email?.toLowerCase().trim(),
        servicos: dto.servicos ? normalizeTomadorServicos(dto.servicos) : undefined,
      };
      if (isCpf(existing.cpfCnpj)) {
        updatePayload.substitutoTributario = false;
      }

      const tomador = await this.tomadorModel.findByIdAndUpdate(
        id,
        updatePayload,
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
    servico?: {
      codigoServico?: string;
      descricaoServico?: string;
    };
    origemCadastro?: TomadorOrigemCadastro;
  }) {
    const empresaCnpj = onlyDigits(input.empresaCnpj);
    const cpfCnpj = onlyDigits(input.cpfCnpj);

    if (empresaCnpj.length !== 14) return null;
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) return null;

    const razaoSocial = nonEmpty(input.razaoSocial);
    if (!razaoSocial) return null;

    const updatePayload: Record<string, unknown> = {
      razaoSocial,
      nomeFantasia: nonEmpty(input.nomeFantasia),
      inscricaoMunicipal: nonEmpty(input.inscricaoMunicipal),
      inscricaoEstadual: nonEmpty(input.inscricaoEstadual),
      suframa: nonEmpty(input.suframa),
      substitutoTributario: isCpf(cpfCnpj)
        ? false
        : typeof input.substitutoTributario === 'boolean' ? input.substitutoTributario : undefined,
      email: nonEmpty(input.email)?.toLowerCase(),
      whatsapp: nonEmpty(input.whatsapp),
      endereco: input.endereco,
    };

    const codigoServico = nonEmpty(input.servico?.codigoServico)?.replace(/\D/g, '').slice(0, 6);
    const descricaoServico = nonEmpty(input.servico?.descricaoServico);
    if (codigoServico && descricaoServico) {
      const existing = await this.tomadorModel.findOne({ empresaCnpj, cpfCnpj }).lean();
      const currentList = Array.isArray(existing?.servicos) ? existing.servicos : [];
      const merged = [
        { codigoServico, descricaoServico, updatedAt: new Date() },
        ...currentList
          .map((item: any) => ({
            codigoServico: nonEmpty(item?.codigoServico)?.replace(/\D/g, '').slice(0, 6),
            descricaoServico: nonEmpty(item?.descricaoServico),
            updatedAt: item?.updatedAt ? new Date(item.updatedAt) : new Date(0),
          }))
          .filter(
            (item: any) =>
              item.codigoServico && item.descricaoServico && item.codigoServico !== codigoServico,
          ),
      ].slice(0, 20);
      updatePayload.servicos = merged;
    }

    return this.tomadorModel.findOneAndUpdate(
      { empresaCnpj, cpfCnpj },
      {
        $set: updatePayload,
        $setOnInsert: {
          empresaCnpj,
          cpfCnpj,
          origemCadastro: input.origemCadastro ?? 'emissao_normal',
        },
      },
      { upsert: true, new: true },
    );
  }
  private normalizeCpfLookup(cpf: string, raw: Record<string, unknown>) {
    const candidate = this.unwrapCpfLookupPayload(raw);

    const nome = this.pickCleanString(candidate, ['nomeCompleto', 'nome_completo', 'nome']);
    const dataNascimento = this.pickCleanString(candidate, ['dataDeNascimento', 'data_nascimento', 'nascimento']);
    const nomeMae = this.pickCleanString(candidate, ['nomeDaMae', 'nome_mae', 'mae']);
    const genero = this.pickCleanString(candidate, ['genero', 'sexo']);
    const lastUpdate = this.pickCleanString(candidate, ['lastUpdate', 'last_update', 'dataAtualizacao', 'data_atualizacao']);

    const emails = this.pickArray(candidate, ['listaEmails', 'lista_emails', 'emails', 'email']);
    const telefones = this.pickArray(candidate, ['listaTelefones', 'lista_telefones', 'telefones', 'telefone', 'celular']);
    const enderecos = this.pickArray(candidate, ['listaEnderecos', 'lista_enderecos', 'enderecos', 'endereco']);

    const email = this.extractEmail(emails);
    const telefone = this.extractTelefone(telefones);
    const endereco = this.extractEndereco(enderecos);

    const providerReturn = this.pickCleanString(raw, ['return', 'status']) ?? this.pickCleanString(candidate, ['return', 'retorno', 'status', 'resultado']);
    const providerMessage = this.pickCleanString(raw, ['message', 'mensagem', 'msg']) ?? this.pickCleanString(candidate, ['message', 'mensagem', 'msg']);
    const providerOk = providerReturn ? /^(ok|success|sucesso)$/i.test(providerReturn) : false;
    const providerNotFound = providerMessage
      ? /(nao encontrado|não encontrado|cpf invalido|cpf inválido|cpf nao encontrado)/i.test(providerMessage)
      : false;

    const found = providerNotFound
      ? false
      : Boolean(
          providerOk || nome || dataNascimento || nomeMae || genero || lastUpdate || emails.length || telefones.length || enderecos.length,
        );
    const usefulAddress = Boolean(
      endereco?.cep ||
        endereco?.logradouro ||
        endereco?.numero ||
        endereco?.bairro ||
        endereco?.complemento,
    );
    const usefulData = Boolean(nome || email || telefone || usefulAddress);

    return {
      cpf,
      source: 'hubdev_cadastropf',
      found,
      usefulData,
      maskedByLgpd: found && !usefulData,
      nome,
      dataNascimento,
      nomeMae,
      genero,
      email,
      whatsapp: telefone,
      telefone,
      endereco,
      lastUpdate,
    };
  }

  private unwrapCpfLookupPayload(raw: Record<string, unknown>) {
    const nestedKeys = ['result', 'data', 'retorno', 'body', 'value'];
    for (const key of nestedKeys) {
      const value = raw[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
    return raw;
  }

  private pickArray(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = raw[key];
      if (Array.isArray(value)) return value as unknown[];
      if (value && typeof value === 'object') return [value as Record<string, unknown>];
      if (typeof value === 'string') return [value];
    }
    return [] as unknown[];
  }

  private pickCleanString(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const cleaned = this.cleanString(raw[key]);
      if (cleaned) return cleaned;
    }
    return undefined;
  }

  private cleanString(value: unknown) {
    if (value === null || value === undefined) return undefined;
    const normalized = String(value).trim();
    if (!normalized) return undefined;
    if (/[#*]/.test(normalized)) return undefined;
    return normalized;
  }

  private cleanDigits(value: unknown, length?: number) {
    const digits = onlyDigits(value === null || value === undefined ? '' : String(value));
    if (!digits) return undefined;
    if (length && digits.length < length) return undefined;
    if (/[#*]/.test(String(value ?? ''))) return undefined;
    return digits;
  }

  private extractEmail(items: unknown[]) {
    for (const item of items) {
      if (typeof item === 'string') {
        const value = this.cleanString(item);
        if (value && value.includes('@')) return value.toLowerCase();
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const value = this.cleanString(row.email ?? row.endereco ?? row.valor ?? row.value);
      if (value && value.includes('@')) return value.toLowerCase();
    }
    return undefined;
  }

  private extractTelefone(items: unknown[]) {
    for (const item of items) {
      if (typeof item === 'string') {
        const digits = this.cleanDigits(item, 8);
        if (digits) return digits;
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const ddd = this.cleanDigits(row.ddd);
      const numero = this.cleanDigits(row.numero ?? row.telefone ?? row.celular ?? row.valor ?? row.value, 8);
      if (!numero) continue;
      return `${ddd ?? ''}${numero}`;
    }
    return undefined;
  }

  private extractEndereco(items: unknown[]) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const endereco = {
        cep: this.cleanDigits(row.cep, 8),
        logradouro: this.cleanString(row.logradouro ?? row.endereco ?? row.rua),
        numero: this.cleanString(row.numero ?? row.numeroLogradouro),
        complemento: this.cleanString(row.complemento),
        bairro: this.cleanString(row.bairro),
        municipio: this.cleanString(row.municipio ?? row.cidade ?? row.localidade),
        uf: this.cleanString(row.uf ?? row.estado)?.toUpperCase(),
      };
      const usefulAddress = Boolean(
        endereco.cep ||
          endereco.logradouro ||
          endereco.numero ||
          endereco.bairro ||
          endereco.complemento,
      );
      if (usefulAddress) return endereco;
    }
    return undefined;
  }

}
