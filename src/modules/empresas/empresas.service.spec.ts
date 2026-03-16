import { EmpresasService } from './empresas.service';

type FindChain = {
  sort: jest.Mock;
  select: jest.Mock;
  limit: jest.Mock;
  lean: jest.Mock;
};

const buildFindChain = (docs: Record<string, unknown>[]): FindChain => {
  const chain: Partial<FindChain> = {};
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue(docs);
  return chain as FindChain;
};

describe('EmpresasService', () => {
  const cnpjaCnpjApi = {
    consultarCnpj: jest.fn(),
  };

  const brasilApiCnpjApi = {
    consultarCnpj: jest.fn(),
  };

  const receitaWsCnpjApi = {
    consultarCnpj: jest.fn(),
  };

  const plugNotasCnpjApi = {
    consultarCnpj: jest.fn(),
  };

  const empresaModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const cnaeCatalogoModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    bulkWrite: jest.fn(),
  };

  const nfseEmissionModel = {
    findOne: jest.fn(),
  };

  let service: EmpresasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmpresasService(
      empresaModel as any,
      cnaeCatalogoModel as any,
      nfseEmissionModel as any,
      cnpjaCnpjApi as any,
      brasilApiCnpjApi as any,
      receitaWsCnpjApi as any,
      plugNotasCnpjApi as any,
    );
  });

  it('searches by legacy CNPJ field cpf_cnpj and normalizes output', async () => {
    const chain = buildFindChain([
      {
        _id: 'legacy-1',
        cpf_cnpj: '43521115000134',
        nome_razao_social: 'BURGUS LTDA',
      },
    ]);
    empresaModel.find.mockReturnValue(chain);

    const result = await service.list({ q: '43.521.115/0001-34', limit: 8 });

    expect(empresaModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([expect.objectContaining({ cpf_cnpj: expect.any(Object) })]),
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'legacy-1',
        _id: 'legacy-1',
        cnpj: '43521115000134',
        razaoSocial: 'BURGUS LTDA',
      }),
    ]);
  });

  it('searches by legacy razao social field nome_razao_social', async () => {
    const chain = buildFindChain([
      {
        _id: 'legacy-2',
        cpf_cnpj: '11111111000191',
        nome_razao_social: 'EMPRESA LEGADO SA',
      },
    ]);
    empresaModel.find.mockReturnValue(chain);

    const result = await service.list({ q: 'legado', limit: 8 });

    expect(empresaModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ nome_razao_social: expect.any(Object) }),
        ]),
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        cnpj: '11111111000191',
        razaoSocial: 'EMPRESA LEGADO SA',
      }),
    );
  });

  it('searches by fantasia in both new and legacy fields', async () => {
    const chain = buildFindChain([
      {
        _id: 'new-1',
        cnpj: '22222222000191',
        razaoSocial: 'NOVA LTDA',
        nomeFantasia: 'ALFA SERVICOS',
      },
      {
        _id: 'legacy-3',
        cpf_cnpj: '33333333000191',
        nome_razao_social: 'ANTIGA LTDA',
        nome_fantasia: 'ALFA LEGADO',
      },
    ]);
    empresaModel.find.mockReturnValue(chain);

    const result = await service.list({ q: 'alfa', limit: 8 });

    expect(empresaModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ nomeFantasia: expect.any(Object) }),
          expect.objectContaining({ nome_fantasia: expect.any(Object) }),
        ]),
      }),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ razaoSocial: 'NOVA LTDA', cnpj: '22222222000191' }),
        expect.objectContaining({ razaoSocial: 'ANTIGA LTDA', cnpj: '33333333000191' }),
      ]),
    );
  });

  it('returns empty array when search finds no results', async () => {
    const chain = buildFindChain([]);
    empresaModel.find.mockReturnValue(chain);

    const result = await service.list({ q: 'inexistente', limit: 8 });

    expect(result).toEqual([]);
  });

  it('respects limit and caps at 100', async () => {
    const chain = buildFindChain([]);
    empresaModel.find.mockReturnValue(chain);

    await service.list({ q: 'empresa', limit: 500 });

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('uses projection for search query to protect autocomplete performance', async () => {
    const chain = buildFindChain([]);
    empresaModel.find.mockReturnValue(chain);

    await service.list({ q: 'empresa', limit: 8 });

    expect(chain.select).toHaveBeenCalledWith(
      expect.objectContaining({
        cnpj: 1,
        cpf_cnpj: 1,
        razaoSocial: 1,
        nome_razao_social: 1,
      }),
    );
  });

  it('finds by CNPJ using legacy field fallback and normalizes response', async () => {
    const toObject = () => ({
      _id: 'legacy-by-cnpj',
      cpf_cnpj: '99999999000191',
      nome_razao_social: 'LEGADO POR CNPJ',
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const result = await service.getByCnpjNormalized('99.999.999/0001-91');

    expect(empresaModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [{ cnpj: '99999999000191' }, { cpf_cnpj: '99999999000191' }],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'legacy-by-cnpj',
        cnpj: '99999999000191',
        razaoSocial: 'LEGADO POR CNPJ',
      }),
    );
  });

  it('marks legacy cadastro as ready for emissão when certificado metadata exists without uploadedAt', async () => {
    const toObject = () => ({
      _id: 'legacy-ready',
      cpf_cnpj: '43521115000134',
      nome_razao_social: 'EMPRESA LEGADO SA',
      inscricao_municipal: '123456',
      endereco: {
        logradouro: 'Rua A',
        numero: '100',
        bairro: 'Centro',
        municipio: 'Manaus',
        uf: 'AM',
        cep: '69000000',
      },
      certificadoDigital: {
        filename: 'empresa-legado.pfx',
      },
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const resumo = await service.getCadastroResumoByCnpj('43.521.115/0001-34');

    expect(resumo).toEqual(
      expect.objectContaining({
        prontoParaEmitir: true,
      }),
    );
    expect(resumo?.camposFaltantesEmissao).not.toContain('certificado.uploadedAt');
  });

  it('marks legacy cadastro as ready when endereço fields are stored at root level', async () => {
    const toObject = () => ({
      _id: 'legacy-root-address',
      cnpj: '12345678000190',
      razaoSocial: 'EMPRESA COM ENDERECO LEGADO',
      inscricaoMunicipal: '998877',
      endereco: 'Av. Brasil',
      numero: '500',
      bairro: 'Centro',
      cidade: 'Manaus',
      uf: 'AM',
      cep: '69000000',
      certificado: {
        filename: 'certificado.pfx',
      },
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const resumo = await service.getCadastroResumoByCnpj('12.345.678/0001-90');

    expect(resumo).toEqual(
      expect.objectContaining({
        prontoParaEmitir: true,
      }),
    );
    expect(resumo?.camposFaltantesEmissao).toEqual([]);
  });

  it('uses CNPJA as primary provider and maps IE/SUFRAMA from arrays', async () => {
    cnpjaCnpjApi.consultarCnpj.mockResolvedValue({
      taxId: '04337168000148',
      alias: 'MOTO HONDA',
      founded: '1975-07-05',
      company: {
        name: 'MOTO HONDA DA AMAZONIA LTDA',
        equity: 1466281857,
        simples: { optant: true, since: '2020-01-01' },
        simei: { optant: false },
      },
      registrations: [
        {
          number: '063002280',
          state: 'AM',
        },
      ],
      suframa: [
        {
          number: '200106023',
        },
      ],
      address: {
        street: 'Rua Exemplo',
        number: '100',
        district: 'Centro',
        city: 'Manaus',
        state: 'AM',
        zip: '69000000',
      },
    });

    const preview = await service.previewFromCnpj('04.337.168/0001-48');

    expect(cnpjaCnpjApi.consultarCnpj).toHaveBeenCalledWith('04337168000148');
    expect(brasilApiCnpjApi.consultarCnpj).not.toHaveBeenCalled();
    expect(preview).toEqual(
      expect.objectContaining({
        cnpj: '04337168000148',
        razaoSocial: 'MOTO HONDA DA AMAZONIA LTDA',
        nomeFantasia: 'MOTO HONDA',
        inscricaoEstadual: '063002280',
        suframa: '200106023',
        opcaoPeloSimples: true,
        opcaoPeloMei: false,
      }),
    );
  });

  it('maps inscrições when CNPJA registrations come with numeric number and municipal type', async () => {
    cnpjaCnpjApi.consultarCnpj.mockResolvedValue({
      taxId: '12345678000190',
      company: { name: 'EMPRESA TESTE LTDA' },
      registrations: [
        { number: 998877, type: { text: 'IM Municipal' } },
        { number: 11223344, type: { text: 'IE Normal' } },
      ],
      suframa: [{ number: 445566 }],
    });

    const preview = await service.previewFromCnpj('12.345.678/0001-90');

    expect(preview).toEqual(
      expect.objectContaining({
        cnpj: '12345678000190',
        inscricaoMunicipal: '998877',
        inscricaoEstadual: '11223344',
        suframa: '445566',
      }),
    );
  });

  it('falls back to BrasilAPI when CNPJA fails', async () => {
    cnpjaCnpjApi.consultarCnpj.mockRejectedValue({ status: 429, body: { message: 'rate limit' } });
    brasilApiCnpjApi.consultarCnpj.mockResolvedValue({
      cnpj: '43521115000134',
      razao_social: 'BURGUS LTDA',
      nome_fantasia: 'ECONTABILIS LTDA',
    });

    const preview = await service.previewFromCnpj('43.521.115/0001-34');

    expect(cnpjaCnpjApi.consultarCnpj).toHaveBeenCalledWith('43521115000134');
    expect(brasilApiCnpjApi.consultarCnpj).toHaveBeenCalledWith('43521115000134');
    expect(preview).toEqual(
      expect.objectContaining({
        cnpj: '43521115000134',
        razaoSocial: 'BURGUS LTDA',
        nomeFantasia: 'ECONTABILIS LTDA',
      }),
    );
  });

  it('repairs incoherent parametroMunicipal for psicologia on normalized output', async () => {
    const toObject = () => ({
      _id: 'empresa-psi',
      cnpj: '12345678000190',
      razaoSocial: 'PSI LTDA',
      parametroMunicipal: [
        {
          codigo: '8650-0/03',
          cnaeDescricao: 'Atividades de psicologia e psicanálise',
          vinculos: [
            {
              id: 'old-1',
              ctn: '040101',
              ctnDescricao: 'Medicina.',
              nbs: '1.2301.22.00',
              nbsDescricao: 'Serviços médicos especializados',
            },
          ],
        },
      ],
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const result = await service.getByCnpjNormalized('12.345.678/0001-90');

    expect(result).toEqual(
      expect.objectContaining({
        parametroMunicipal: [
          expect.objectContaining({
            codigo: '8650003',
            vinculos: [
              expect.objectContaining({
                ctn: '041601',
                ctnDescricao: 'Psicologia.',
                nbs: '1.2301.98.00',
                nbsDescricao: 'Serviços de psicologia',
              }),
              expect.objectContaining({
                ctn: '041501',
                ctnDescricao: 'Psicanálise.',
                nbs: '1.2301.13.00',
                nbsDescricao: 'Serviços psiquiátricos',
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('normalizes parametroMunicipal before persisting payload overrides', () => {
    const patch = (service as any).pickEmpresaOverrides({
      parametroMunicipal: [
        {
          codigo: '8650-0/03',
          vinculos: [
            {
              ctn: '040101',
              ctnDescricao: 'Medicina.',
              nbs: '1.2301.22.00',
              nbsDescricao: 'Serviços médicos especializados',
            },
          ],
        },
      ],
    });

    expect(patch.parametroMunicipal).toEqual([
      expect.objectContaining({
        codigo: '8650003',
        vinculos: [
          expect.objectContaining({
            ctn: '041601',
            ctnDescricao: 'Psicologia.',
            nbs: '1.2301.98.00',
            nbsDescricao: 'Serviços de psicologia',
          }),
          expect.objectContaining({
            ctn: '041501',
            ctnDescricao: 'Psicanálise.',
            nbs: '1.2301.13.00',
            nbsDescricao: 'Serviços psiquiátricos',
          }),
        ],
      }),
    ]);
  });

  it('reconciles empty parametroMunicipal on update using canonical defaults for psicologia', async () => {
    empresaModel.findById.mockResolvedValue({
      toObject: () => ({
        _id: 'empresa-psi',
        cnaeFiscal: '8650003',
        cnaeFiscalDescricao: 'Atividades de psicologia e psicanálise',
        parametroMunicipal: [],
        ctnCodigo: '040101',
        nbsCodigo: '1.2301.22.00',
        regimeTributario: 'simples_nacional',
        rbt12: 180000,
        cnaesLista: [
          {
            codigo: '8650003',
            descricao: 'Atividades de psicologia e psicanálise',
            isPrincipal: true,
            anexo: 'III',
          },
        ],
      }),
    });
    empresaModel.findByIdAndUpdate.mockResolvedValue({
      toObject: () => ({
        _id: 'empresa-psi',
        cnaeFiscal: '8650003',
        parametroMunicipal: [
          {
            codigo: '8650003',
            vinculos: [
              {
                ctn: '041601',
                ctnDescricao: 'Psicologia.',
                nbs: '1.2301.98.00',
                nbsDescricao: 'Serviços de psicologia',
              },
              {
                ctn: '041501',
                ctnDescricao: 'Psicanálise.',
                nbs: '1.2301.13.00',
                nbsDescricao: 'Serviços psiquiátricos',
              },
            ],
          },
        ],
        ctnCodigo: '041601',
        nbsCodigo: '1.2301.98.00',
        simplesSnapshot: {
          anexo: 'III',
          faixa: 1,
          aliquotaNominal: 0.06,
          parcelaDeduzir: 0,
          aliquotaEfetiva: 0.06,
          issReferencia: 0.0201,
          rbt12: 180000,
          valido: true,
        },
      }),
    });

    await service.update('empresa-psi', {
      cnaeFiscal: '8650003',
      parametroMunicipal: [],
      ctnCodigo: '040101',
      nbsCodigo: '1.2301.22.00',
      regimeTributario: 'simples_nacional',
      rbt12: 180000,
      cnaesLista: [
        {
          codigo: '8650003',
          descricao: 'Atividades de psicologia e psicanálise',
          isPrincipal: true,
          anexo: 'III',
        },
      ],
    });

    expect(empresaModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'empresa-psi',
      expect.objectContaining({
        ctnCodigo: '041601',
        nbsCodigo: '1.2301.98.00',
        parametroMunicipal: [
          expect.objectContaining({
            codigo: '8650003',
            vinculos: [
              expect.objectContaining({ ctn: '041601', nbs: '1.2301.98.00' }),
              expect.objectContaining({ ctn: '041501', nbs: '1.2301.13.00' }),
            ],
          }),
        ],
        simplesSnapshot: expect.objectContaining({
          anexo: 'III',
          faixa: 1,
          aliquotaNominal: 0.06,
          parcelaDeduzir: 0,
          aliquotaEfetiva: 0.06,
          issReferencia: 0.0201,
          rbt12: 180000,
          valido: true,
        }),
      }),
      { new: true },
    );
  });

  it('marks simplesSnapshot as invalid when anexo is unsupported for calculation', async () => {
    empresaModel.findById.mockResolvedValue({
      toObject: () => ({
        _id: 'empresa-faixa-invalida',
      }),
    });
    empresaModel.findByIdAndUpdate.mockResolvedValue({
      toObject: () => ({
        _id: 'empresa-faixa-invalida',
      }),
    });

    await service.update('empresa-faixa-invalida', {
      regimeTributario: 'simples_nacional',
      rbt12: 200000,
      cnaesLista: [
        {
          codigo: '6201500',
          descricao: 'Desenvolvimento de software',
          isPrincipal: true,
          anexo: 'V',
        },
      ],
    });

    expect(empresaModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'empresa-faixa-invalida',
      expect.objectContaining({
        simplesSnapshot: expect.objectContaining({
          anexo: 'V',
          rbt12: 200000,
          valido: false,
        }),
      }),
      { new: true },
    );
  });

  it('exposes biCatalogoResumo with canonical counts on normalized output', async () => {
    const toObject = () => ({
      _id: 'empresa-bi',
      cnpj: '12345678000190',
      razaoSocial: 'EMPRESA BI LTDA',
      cnaesLista: [
        {
          codigo: '8650003',
          descricao: 'Atividades de psicologia e psicanálise',
          isPrincipal: true,
        },
        { codigo: '6201500', descricao: 'Desenvolvimento de software', isPrincipal: false },
      ],
      parametroMunicipal: [
        {
          codigo: '8650003',
          vinculos: [
            { ctn: '041601', nbs: '1.2301.98.00' },
            { ctn: '041501', nbs: '1.2301.13.00' },
          ],
        },
      ],
      configOperacionais: [
        { id: 'cfg-1', natureza: 'Consulta', descricao: 'Consulta de psicologia' },
        { id: 'cfg-2', natureza: 'Grupo', descricao: 'Sessão em grupo' },
      ],
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const result = await service.getByCnpjNormalized('12.345.678/0001-90');

    expect(result).toEqual(
      expect.objectContaining({
        biCatalogoResumo: {
          totalCnaes: 2,
          totalFavoritosMunicipais: 1,
          totalVinculosMunicipais: 2,
          totalConfigOperacionais: 2,
        },
      }),
    );
  });

  it('exposes prontoParaBi when prestador has analytic completeness required for BI', async () => {
    const toObject = () => ({
      _id: 'empresa-bi-ok',
      cnpj: '12345678000190',
      razaoSocial: 'EMPRESA BI LTDA',
      nomeFantasia: 'EMPRESA BI',
      inscricaoMunicipal: '998877',
      email: 'contato@empresa.bi',
      whatsapp: '(92) 99999-0000',
      regimeTributario: 'simples_nacional',
      cnaeFiscal: '8650003',
      cnaeFiscalDescricao: 'Atividades de psicologia e psicanálise',
      ctnCodigo: '041601',
      nbsCodigo: '1.2301.98.00',
      rbt12: 180000,
      aliquotaSimplesNacional: '6,00',
      apuracaoSimplesNacional: 'MENSAL',
      simplesSnapshot: {
        anexo: 'III',
        faixa: 1,
        aliquotaNominal: 0.06,
        parcelaDeduzir: 0,
        aliquotaEfetiva: 0.06,
        issReferencia: 0.0201,
        rbt12: 180000,
        valido: true,
      },
      certificado: {
        filename: 'certificado.pfx',
        uploadedAt: new Date().toISOString(),
      },
      endereco: {
        logradouro: 'RUA A',
        numero: '100',
        bairro: 'CENTRO',
        cidade: 'MANAUS',
        uf: 'AM',
        cep: '69000000',
      },
      cnaesLista: [
        {
          codigo: '8650003',
          descricao: 'Atividades de psicologia e psicanálise',
          isPrincipal: true,
          anexo: 'III',
        },
      ],
      parametroMunicipal: [
        {
          codigo: '8650003',
          vinculos: [{ ctn: '041601', nbs: '1.2301.98.00' }],
        },
      ],
      configOperacionais: [
        { id: 'cfg-1', natureza: 'Consulta', descricao: 'Consulta de psicologia' },
      ],
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const result = await service.getByCnpjNormalized('12.345.678/0001-90');

    expect(result).toEqual(
      expect.objectContaining({
        prontoParaBi: true,
        percentualCompletudeBi: 100,
        camposFaltantesBi: [],
      }),
    );
  });

  it('lists camposFaltantesBi for simples prestador with incomplete analytic cadastro', async () => {
    const toObject = () => ({
      _id: 'empresa-bi-pendente',
      cnpj: '12345678000190',
      razaoSocial: 'EMPRESA BI LTDA',
      inscricaoMunicipal: '998877',
      regimeTributario: 'simples_nacional',
      cnaeFiscal: '8650003',
      cnaeFiscalDescricao: 'Atividades de psicologia e psicanálise',
      endereco: {
        logradouro: 'RUA A',
        numero: '100',
        bairro: 'CENTRO',
        cidade: 'MANAUS',
        uf: 'AM',
        cep: '69000000',
      },
      certificado: {
        filename: 'certificado.pfx',
      },
      cnaesLista: [],
      parametroMunicipal: [],
      configOperacionais: [],
    });
    empresaModel.findOne.mockResolvedValue({ toObject });

    const result = await service.getByCnpjNormalized('12.345.678/0001-90');

    expect(result).toEqual(
      expect.objectContaining({
        prontoParaBi: false,
        camposFaltantesBi: expect.arrayContaining([
          'nomeFantasia',
          'email',
          'whatsapp',
          'ctnCodigo',
          'nbsCodigo',
          'parametroMunicipal',
          'cnaesLista',
          'configOperacionais',
          'rbt12',
          'aliquotaSimplesNacional',
          'apuracaoSimplesNacional',
          'simplesSnapshot',
        ]),
      }),
    );
  });
});
