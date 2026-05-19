import { PlugNotasPrerequisitesService } from './prerequisites.service';

describe('PlugNotasPrerequisitesService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PLUGNOTAS_API_KEY = 'test-key';
    process.env.PLUGNOTAS_PREREQ_MODE = 'warn';
    process.env.PLUGNOTAS_PREREQ_CHECK_CITY = 'true';
    process.env.PLUGNOTAS_PREREQ_ENABLE_COMPANY = 'false';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('checks city homologation when prereq mode is warn', async () => {
    const request = jest.fn().mockResolvedValue({ homologada: true });
    const service = new PlugNotasPrerequisitesService({ request } as any);

    await expect(
      service.ensureBeforeIssuance({
        prestadorCnpj: '43521115000134',
        codigoCidadeIbge: '1302603',
      }),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/Auxiliares/getCidadeById?id=1302603',
    });
  });

  it('enables NFS-e Nacional through PATCH /empresa/{cnpj} when company prereq is enabled', async () => {
    process.env.PLUGNOTAS_PREREQ_ENABLE_COMPANY = 'true';
    const request = jest
      .fn()
      .mockResolvedValueOnce({ homologada: true })
      .mockResolvedValueOnce({ message: 'Operação realizada com sucesso', data: {} });
    const service = new PlugNotasPrerequisitesService({ request } as any);

    await expect(
      service.ensureBeforeIssuance({
        prestadorCnpj: '43521115000134',
        codigoCidadeIbge: '1302603',
      }),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'PATCH',
      path: '/empresa/43521115000134',
      body: {
        nfse: {
          config: {
            nfseNacional: true,
          },
        },
      },
    });
  });

  it('throws on failed city check when mode is enforce', async () => {
    process.env.PLUGNOTAS_PREREQ_MODE = 'enforce';
    const request = jest.fn().mockRejectedValue({
      status: 500,
      message: 'provider down',
    });
    const service = new PlugNotasPrerequisitesService({ request } as any);

    await expect(
      service.ensureBeforeIssuance({
        prestadorCnpj: '43521115000134',
        codigoCidadeIbge: '1302603',
      }),
    ).rejects.toMatchObject({
      message: 'PlugNotas prerequisite failed: city_homologation',
      code: 'PLUGNOTAS_PREREQ_FAILED',
    });
  });
});
