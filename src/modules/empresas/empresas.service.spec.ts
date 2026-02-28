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
  };

  let service: EmpresasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmpresasService(
      empresaModel as any,
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
});
