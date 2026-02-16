import { EmitirNfseQuickService } from './emitir-nfse-quick.service';

describe('EmitirNfseQuickService', () => {
  const empresa = {
    cnpj: '43521115000134',
    razaoSocial: 'BURGUS LTDA',
    inscricaoMunicipal: '51754301',
    certificado: { uploadedAt: new Date() },
    endereco: {
      logradouro: 'Rua Saldanha Marinho',
      numero: '606',
      bairro: 'Centro',
      cidade: 'Manaus',
      uf: 'AM',
      cep: '69010040',
    },
  };

  const servicoCatalog = {
    findByCodigo: jest.fn().mockReturnValue(null),
  };

  const empresasService = {
    getByCnpj: jest.fn().mockResolvedValue(empresa),
  };

  const emitirNfseService = {
    execute: jest.fn().mockResolvedValue({ ok: true }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.QUICK_NFSE_OP_SIMP_NAC;
    delete process.env.QUICK_NFSE_REG_AP_TRIB_SN;
    delete process.env.QUICK_NFSE_REG_ESP_TRIB;
  });

  it('applies default SN tax regime in quick payload', async () => {
    const service = new EmitirNfseQuickService(
      emitirNfseService as any,
      empresasService as any,
      servicoCatalog as any,
    );

    await service.execute({
      cnpj: '43.521.115/0001-34',
      cpfTomador: '61020788100',
      valor: 125,
    });

    const payload = emitirNfseService.execute.mock.calls[0][0];
    expect(payload.prestador.regimeTributarioSn).toEqual({
      opSimpNac: 3,
      regApTribSN: 1,
      regEspTrib: 0,
    });
  });

  it('does not send SN tax regime when provider data marks company as non-optant', async () => {
    empresasService.getByCnpj.mockResolvedValueOnce({
      ...empresa,
      providerData: {
        simples: {
          optante: false,
        },
      },
    });

    const service = new EmitirNfseQuickService(
      emitirNfseService as any,
      empresasService as any,
      servicoCatalog as any,
    );

    await service.execute({
      cnpj: '43.521.115/0001-34',
      cpfTomador: '61020788100',
      valor: 125,
    });

    const payload = emitirNfseService.execute.mock.calls[0][0];
    expect(payload.prestador.regimeTributarioSn).toBeUndefined();
  });
});
