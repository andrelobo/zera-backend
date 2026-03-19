import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NfseEmission, NfseEmissionDocument } from '../schemas/nfse-emission.schema';
import { NfseEmissionStatus } from '../../../domain/types/nfse-emission-status';

@Injectable()
export class NfseEmissionRepository {
  constructor(
    @InjectModel(NfseEmission.name)
    private readonly model: Model<NfseEmissionDocument>,
  ) {}

  async create(input: {
    provider: string;
    payload: Record<string, any>;
    biSnapshot?: Record<string, any>;
    empresaCnpj?: string;
    tomadorCpfCnpj?: string;
    tomadorRazaoSocial?: string;
    tomadorInscricaoMunicipal?: string;
    tomadorEmail?: string;
    tomadorMunicipio?: string;
    tomadorUf?: string;
    descricaoServico?: string;
    codigoServico?: string;
    servicoCodigoMunicipal?: string;
    servicoCodigoNacional?: string;
    localPrestacaoPais?: string;
    localPrestacaoUf?: string;
    localPrestacaoMunicipio?: string;
    numeroNfse?: string;
    competencia?: string;
    dataEmissao?: string;
    valorServico?: number;
    baseCalculo?: number;
    desconto?: number;
    aliquotaIss?: number;
    valorIss?: number;
    retPis?: number;
    retCofins?: number;
    retCsll?: number;
    retIr?: number;
    retInss?: number;
    tributacaoTotalFederal?: number;
    tributacaoTotalEstadual?: number;
    tributacaoTotalMunicipal?: number;
    idempotencyKey?: string;
    status?: NfseEmissionStatus;
    externalId?: string;
    providerResponse?: Record<string, any>;
  }): Promise<NfseEmissionDocument> {
    const now = new Date();
    return this.model.create({
      provider: input.provider,
      payload: input.payload,
      biSnapshot: input.biSnapshot,
      empresaCnpj: input.empresaCnpj,
      tomadorCpfCnpj: input.tomadorCpfCnpj,
      tomadorRazaoSocial: input.tomadorRazaoSocial,
      tomadorInscricaoMunicipal: input.tomadorInscricaoMunicipal,
      tomadorEmail: input.tomadorEmail,
      tomadorMunicipio: input.tomadorMunicipio,
      tomadorUf: input.tomadorUf,
      descricaoServico: input.descricaoServico,
      codigoServico: input.codigoServico,
      servicoCodigoMunicipal: input.servicoCodigoMunicipal,
      servicoCodigoNacional: input.servicoCodigoNacional,
      localPrestacaoPais: input.localPrestacaoPais,
      localPrestacaoUf: input.localPrestacaoUf,
      localPrestacaoMunicipio: input.localPrestacaoMunicipio,
      numeroNfse: input.numeroNfse,
      competencia: input.competencia,
      dataEmissao: input.dataEmissao,
      valorServico: input.valorServico,
      baseCalculo: input.baseCalculo,
      desconto: input.desconto,
      aliquotaIss: input.aliquotaIss,
      valorIss: input.valorIss,
      retPis: input.retPis,
      retCofins: input.retCofins,
      retCsll: input.retCsll,
      retIr: input.retIr,
      retInss: input.retInss,
      tributacaoTotalFederal: input.tributacaoTotalFederal,
      tributacaoTotalEstadual: input.tributacaoTotalEstadual,
      tributacaoTotalMunicipal: input.tributacaoTotalMunicipal,
      idempotencyKey: input.idempotencyKey,
      status: input.status ?? NfseEmissionStatus.PENDING,
      externalId: input.externalId,
      providerResponse: input.providerResponse,
      pollAttempts: 0,
      lastPolledAt: now,
      nextPollAt: now,
    });
  }

  async updateEmission(
    id: string,
    patch: Partial<{
      provider: string;
      status: NfseEmissionStatus;
      externalId: string;
      providerResponse: Record<string, any> | null;
      providerRequest: Record<string, any> | null;
      error: string | null;
      xmlBase64: string | null;
      pdfBase64: string | null;
      pollAttempts: number;
      lastPollError: string | null;
      lastPolledAt: Date | null;
      lastWebhookAt: Date | null;
      lastUpdateSource: string | null;
      nextPollAt: Date | null;
    }>,
  ): Promise<void> {
    const update: Record<string, any> = {};
    if (patch.provider !== undefined) update.provider = patch.provider;
    if (patch.externalId !== undefined) update.externalId = patch.externalId;
    if (patch.providerResponse !== undefined) update.providerResponse = patch.providerResponse;
    if (patch.providerRequest !== undefined) update.providerRequest = patch.providerRequest;
    if (patch.error !== undefined) update.error = patch.error;
    if (patch.xmlBase64 !== undefined) update.xmlBase64 = patch.xmlBase64;
    if (patch.pdfBase64 !== undefined) update.pdfBase64 = patch.pdfBase64;
    if (patch.pollAttempts !== undefined) update.pollAttempts = patch.pollAttempts;
    if (patch.lastPollError !== undefined) update.lastPollError = patch.lastPollError;
    if (patch.lastPolledAt !== undefined) update.lastPolledAt = patch.lastPolledAt;
    if (patch.lastWebhookAt !== undefined) update.lastWebhookAt = patch.lastWebhookAt;
    if (patch.lastUpdateSource !== undefined) update.lastUpdateSource = patch.lastUpdateSource;
    if (patch.nextPollAt !== undefined) update.nextPollAt = patch.nextPollAt;
    if (patch.status !== undefined) update.status = patch.status;

    const hasStatus = patch.status !== undefined;

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
    );
  }

  async updateByExternalId(input: {
    externalId: string;
    status: NfseEmissionStatus;
    providerResponse?: Record<string, any>;
    error?: string;
    provider?: string;
    xmlBase64?: string;
    pdfBase64?: string;
    lastWebhookAt?: Date;
    lastUpdateSource?: string;
  }): Promise<{ matchedCount: number; modifiedCount: number }> {
    const filter: Record<string, any> = {
      externalId: input.externalId,
      $or: [{ status: NfseEmissionStatus.PENDING }, { status: input.status }],
    };

    if (input.provider) {
      filter.provider = input.provider;
    }

    const update: Record<string, any> = {
      status: input.status,
      providerResponse: input.providerResponse,
      error: input.error,
      lastPolledAt: new Date(),
    };

    if (input.xmlBase64 !== undefined) update.xmlBase64 = input.xmlBase64;
    if (input.pdfBase64 !== undefined) update.pdfBase64 = input.pdfBase64;
    if (input.lastWebhookAt !== undefined) update.lastWebhookAt = input.lastWebhookAt;
    if (input.lastUpdateSource !== undefined) update.lastUpdateSource = input.lastUpdateSource;

    if (input.status !== NfseEmissionStatus.PENDING) {
      update.nextPollAt = null;
      update.lastPollError = null;
    }

    const result = await this.model.updateOne(filter, update);

    return {
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
    };
  }

  async markPollingTransientFailure(input: {
    externalId: string;
    provider?: string;
    message: string;
    nextPollAt: Date;
  }): Promise<void> {
    const filter: Record<string, any> = {
      externalId: input.externalId,
      status: NfseEmissionStatus.PENDING,
    };

    if (input.provider) {
      filter.provider = input.provider;
    }

    await this.model.updateOne(filter, {
      $inc: { pollAttempts: 1 },
      $set: {
        lastPollError: input.message,
        lastPolledAt: new Date(),
        lastUpdateSource: 'polling',
        nextPollAt: input.nextPollAt,
      },
    });
  }

  async findPending(input?: {
    provider?: string;
    limit?: number;
    olderThanMs?: number;
    now?: Date;
  }): Promise<NfseEmissionDocument[]> {
    const now = input?.now ?? new Date();

    const filter: Record<string, any> = {
      status: NfseEmissionStatus.PENDING,
      $or: [
        { nextPollAt: { $lte: now } },
        { nextPollAt: null },
        { nextPollAt: { $exists: false } },
      ],
    };

    if (input?.provider) filter.provider = input.provider;
    if (input?.olderThanMs && input.olderThanMs > 0) {
      filter.createdAt = { $lte: new Date(Date.now() - input.olderThanMs) };
    }

    const limit = input?.limit && input.limit > 0 ? input.limit : 50;

    return this.model.find(filter).sort({ createdAt: 1 }).limit(limit).exec();
  }

  async findPaginated(input?: {
    page?: number;
    limit?: number;
    provider?: string;
    status?: NfseEmissionStatus;
    createdFrom?: Date;
    createdTo?: Date;
  }): Promise<{
    items: NfseEmissionDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = input?.page && input.page > 0 ? input.page : 1;
    const limit = input?.limit && input.limit > 0 ? Math.min(input.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (input?.provider) filter.provider = input.provider;
    if (input?.status) filter.status = input.status;
    if (input?.createdFrom || input?.createdTo) {
      filter.createdAt = {};
      if (input.createdFrom) filter.createdAt.$gte = input.createdFrom;
      if (input.createdTo) filter.createdAt.$lte = input.createdTo;
    }

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getBiSummary(input?: {
    provider?: string;
    status?: NfseEmissionStatus;
    createdFrom?: Date;
    createdTo?: Date;
    empresaCnpj?: string;
    codigoServico?: string;
  }): Promise<{
    totals: {
      totalEmissoes: number;
      totalAutorizadas: number;
      totalPendentes: number;
      totalRejeitadas: number;
      totalCanceladas: number;
      totalComErro: number;
      somaValorServico: number;
      somaBaseCalculo: number;
      somaDesconto: number;
      somaValorIss: number;
      somaRetencoes: number;
      ticketMedio: number;
    };
    retencoes: {
      pis: number;
      cofins: number;
      csll: number;
      ir: number;
      inss: number;
    };
    tributacaoTotal: {
      federal: number;
      estadual: number;
      municipal: number;
    };
    seriesCompetencia: Array<{
      competencia: string;
      quantidade: number;
      valorServico: number;
      valorIss: number;
    }>;
    topServicos: Array<{
      codigoServico: string;
      descricaoServico: string;
      quantidade: number;
      valorServico: number;
    }>;
    topMunicipiosPrestacao: Array<{
      municipio: string;
      uf: string;
      quantidade: number;
      valorServico: number;
    }>;
    topTomadores: Array<{
      cpfCnpj: string;
      razaoSocial: string;
      quantidade: number;
      valorServico: number;
    }>;
  }> {
    const filter: Record<string, any> = {};
    if (input?.provider) filter.provider = input.provider;
    if (input?.status) filter.status = input.status;
    if (input?.empresaCnpj) filter.empresaCnpj = input.empresaCnpj;
    if (input?.codigoServico) filter.codigoServico = input.codigoServico;
    if (input?.createdFrom || input?.createdTo) {
      filter.createdAt = {};
      if (input.createdFrom) filter.createdAt.$gte = input.createdFrom;
      if (input.createdTo) filter.createdAt.$lte = input.createdTo;
    }

    const [agg] = await this.model.aggregate([
      { $match: filter },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalEmissoes: { $sum: 1 },
                totalAutorizadas: {
                  $sum: { $cond: [{ $eq: ['$status', NfseEmissionStatus.AUTHORIZED] }, 1, 0] },
                },
                totalPendentes: {
                  $sum: { $cond: [{ $eq: ['$status', NfseEmissionStatus.PENDING] }, 1, 0] },
                },
                totalRejeitadas: {
                  $sum: { $cond: [{ $eq: ['$status', NfseEmissionStatus.REJECTED] }, 1, 0] },
                },
                totalCanceladas: {
                  $sum: { $cond: [{ $eq: ['$status', NfseEmissionStatus.CANCELED] }, 1, 0] },
                },
                totalComErro: {
                  $sum: { $cond: [{ $eq: ['$status', NfseEmissionStatus.ERROR] }, 1, 0] },
                },
                somaValorServico: { $sum: { $ifNull: ['$valorServico', 0] } },
                somaBaseCalculo: { $sum: { $ifNull: ['$baseCalculo', 0] } },
                somaDesconto: { $sum: { $ifNull: ['$desconto', 0] } },
                somaValorIss: { $sum: { $ifNull: ['$valorIss', 0] } },
                retPis: { $sum: { $ifNull: ['$retPis', 0] } },
                retCofins: { $sum: { $ifNull: ['$retCofins', 0] } },
                retCsll: { $sum: { $ifNull: ['$retCsll', 0] } },
                retIr: { $sum: { $ifNull: ['$retIr', 0] } },
                retInss: { $sum: { $ifNull: ['$retInss', 0] } },
                tributacaoTotalFederal: {
                  $sum: { $ifNull: ['$tributacaoTotalFederal', 0] },
                },
                tributacaoTotalEstadual: {
                  $sum: { $ifNull: ['$tributacaoTotalEstadual', 0] },
                },
                tributacaoTotalMunicipal: {
                  $sum: { $ifNull: ['$tributacaoTotalMunicipal', 0] },
                },
              },
            },
          ],
          seriesCompetencia: [
            {
              $group: {
                _id: { $ifNull: ['$competencia', 'SEM_COMPETENCIA'] },
                quantidade: { $sum: 1 },
                valorServico: { $sum: { $ifNull: ['$valorServico', 0] } },
                valorIss: { $sum: { $ifNull: ['$valorIss', 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
          topServicos: [
            {
              $group: {
                _id: {
                  codigoServico: { $ifNull: ['$codigoServico', 'SEM_CODIGO'] },
                  descricaoServico: { $ifNull: ['$descricaoServico', 'Sem descrição'] },
                },
                quantidade: { $sum: 1 },
                valorServico: { $sum: { $ifNull: ['$valorServico', 0] } },
              },
            },
            { $sort: { valorServico: -1, quantidade: -1 } },
            { $limit: 10 },
          ],
          topMunicipiosPrestacao: [
            {
              $group: {
                _id: {
                  municipio: { $ifNull: ['$localPrestacaoMunicipio', 'SEM_MUNICIPIO'] },
                  uf: { $ifNull: ['$localPrestacaoUf', 'SEM_UF'] },
                },
                quantidade: { $sum: 1 },
                valorServico: { $sum: { $ifNull: ['$valorServico', 0] } },
              },
            },
            { $sort: { valorServico: -1, quantidade: -1 } },
            { $limit: 10 },
          ],
          topTomadores: [
            {
              $group: {
                _id: {
                  cpfCnpj: { $ifNull: ['$tomadorCpfCnpj', 'SEM_DOCUMENTO'] },
                  razaoSocial: { $ifNull: ['$tomadorRazaoSocial', 'Sem nome'] },
                },
                quantidade: { $sum: 1 },
                valorServico: { $sum: { $ifNull: ['$valorServico', 0] } },
              },
            },
            { $sort: { valorServico: -1, quantidade: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]);

    const totalsRaw = (agg?.totals?.[0] ?? {}) as Record<string, number>;
    const retencoes = {
      pis: Number(totalsRaw.retPis ?? 0),
      cofins: Number(totalsRaw.retCofins ?? 0),
      csll: Number(totalsRaw.retCsll ?? 0),
      ir: Number(totalsRaw.retIr ?? 0),
      inss: Number(totalsRaw.retInss ?? 0),
    };
    const tributacaoTotal = {
      federal: Number(totalsRaw.tributacaoTotalFederal ?? 0),
      estadual: Number(totalsRaw.tributacaoTotalEstadual ?? 0),
      municipal: Number(totalsRaw.tributacaoTotalMunicipal ?? 0),
    };
    const totalEmissoes = Number(totalsRaw.totalEmissoes ?? 0);
    const somaValorServico = Number(totalsRaw.somaValorServico ?? 0);
    const somaRetencoes =
      retencoes.pis + retencoes.cofins + retencoes.csll + retencoes.ir + retencoes.inss;

    return {
      totals: {
        totalEmissoes,
        totalAutorizadas: Number(totalsRaw.totalAutorizadas ?? 0),
        totalPendentes: Number(totalsRaw.totalPendentes ?? 0),
        totalRejeitadas: Number(totalsRaw.totalRejeitadas ?? 0),
        totalCanceladas: Number(totalsRaw.totalCanceladas ?? 0),
        totalComErro: Number(totalsRaw.totalComErro ?? 0),
        somaValorServico,
        somaBaseCalculo: Number(totalsRaw.somaBaseCalculo ?? 0),
        somaDesconto: Number(totalsRaw.somaDesconto ?? 0),
        somaValorIss: Number(totalsRaw.somaValorIss ?? 0),
        somaRetencoes,
        ticketMedio: totalEmissoes > 0 ? Number((somaValorServico / totalEmissoes).toFixed(2)) : 0,
      },
      retencoes,
      tributacaoTotal,
      seriesCompetencia: (agg?.seriesCompetencia ?? []).map((item: any) => ({
        competencia: String(item._id ?? 'SEM_COMPETENCIA'),
        quantidade: Number(item.quantidade ?? 0),
        valorServico: Number(item.valorServico ?? 0),
        valorIss: Number(item.valorIss ?? 0),
      })),
      topServicos: (agg?.topServicos ?? []).map((item: any) => ({
        codigoServico: String(item._id?.codigoServico ?? 'SEM_CODIGO'),
        descricaoServico: String(item._id?.descricaoServico ?? 'Sem descrição'),
        quantidade: Number(item.quantidade ?? 0),
        valorServico: Number(item.valorServico ?? 0),
      })),
      topMunicipiosPrestacao: (agg?.topMunicipiosPrestacao ?? []).map((item: any) => ({
        municipio: String(item._id?.municipio ?? 'SEM_MUNICIPIO'),
        uf: String(item._id?.uf ?? 'SEM_UF'),
        quantidade: Number(item.quantidade ?? 0),
        valorServico: Number(item.valorServico ?? 0),
      })),
      topTomadores: (agg?.topTomadores ?? []).map((item: any) => ({
        cpfCnpj: String(item._id?.cpfCnpj ?? 'SEM_DOCUMENTO'),
        razaoSocial: String(item._id?.razaoSocial ?? 'Sem nome'),
        quantidade: Number(item.quantidade ?? 0),
        valorServico: Number(item.valorServico ?? 0),
      })),
    };
  }

  async findById(id: string): Promise<NfseEmissionDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model.findById(id).exec();
  }

  async findByExternalId(externalId: string): Promise<NfseEmissionDocument | null> {
    return this.model.findOne({ externalId }).exec();
  }

  async findByIdempotencyKey(
    provider: string,
    idempotencyKey: string,
  ): Promise<NfseEmissionDocument | null> {
    return this.model.findOne({ provider, idempotencyKey }).exec();
  }

  async findByReference(
    provider: string,
    referenciaExterna: string,
  ): Promise<NfseEmissionDocument | null> {
    return this.model
      .findOne({
        provider,
        $or: [
          { idempotencyKey: referenciaExterna },
          { 'payload.referenciaExterna': referenciaExterna },
        ],
      })
      .exec();
  }

  async appendArtifactSyncAudit(
    id: string,
    input: {
      at: Date;
      outcome: string;
      message?: string;
      requestedBy?: string | null;
      ip?: string | null;
    },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
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
    );
  }

  async saveArtifactsById(input: {
    id: string;
    status?: NfseEmissionStatus;
    providerResponse?: Record<string, any>;
    xmlBase64: string;
    pdfBase64: string;
    error?: string | null;
  }): Promise<void> {
    if (!Types.ObjectId.isValid(input.id)) return;
    const update: Record<string, any> = {
      providerResponse: input.providerResponse,
      xmlBase64: input.xmlBase64,
      pdfBase64: input.pdfBase64,
      error: input.error ?? null,
      lastPolledAt: new Date(),
    };
    if (input.status) update.status = input.status;
    await this.model.updateOne({ _id: input.id }, update);
  }
}
