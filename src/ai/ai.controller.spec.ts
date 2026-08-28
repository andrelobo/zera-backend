import { AiController } from './ai.controller';

describe('AiController', () => {
  const scopedReq = {
    user: {
      id: 'user-1',
      email: 'user@jupati.local',
      role: 'user',
      allowedCompanyCnpjs: ['43521115000134'],
    },
  } as any;
  const diagnoseAgent = {
    diagnoseEmission: jest.fn(),
  };

  let controller: AiController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AiController(diagnoseAgent as any);
  });

  it('delegates emission diagnosis by emissionId to DiagnoseAgent', async () => {
    diagnoseAgent.diagnoseEmission.mockResolvedValue({
      agent: 'DiagnoseAgent',
      mode: 'deterministic',
      severity: 'low',
      probableLayer: 'webhook',
      probableCause: 'webhook_operational',
      summary: 'ok',
      recommendedActions: [],
      confidence: 0.99,
      evidence: { empresaCnpj: '43521115000134' },
      references: [],
    });

    const dto = { emissionId: '680a7fb7b68434370d8a4cd2' };

    await expect(controller.diagnoseEmission(dto, scopedReq)).resolves.toEqual(
      expect.objectContaining({
        agent: 'DiagnoseAgent',
        probableCause: 'webhook_operational',
      }),
    );
    expect(diagnoseAgent.diagnoseEmission).toHaveBeenCalledWith(dto);
  });

  it('delegates emission diagnosis by externalId to DiagnoseAgent', async () => {
    diagnoseAgent.diagnoseEmission.mockResolvedValue({
      agent: 'DiagnoseAgent',
      mode: 'deterministic',
      severity: 'high',
      probableLayer: 'provider',
      probableCause: 'provider_temporarily_unavailable',
      summary: 'indisponivel',
      recommendedActions: ['retentar depois'],
      confidence: 0.93,
      evidence: { empresaCnpj: '43521115000134' },
      references: [],
    });

    const dto = { externalId: 'quick-15000134-20260511120000-ab12cd' };

    await expect(controller.diagnoseEmission(dto, scopedReq)).resolves.toEqual(
      expect.objectContaining({
        agent: 'DiagnoseAgent',
        probableLayer: 'provider',
      }),
    );
    expect(diagnoseAgent.diagnoseEmission).toHaveBeenCalledWith(dto);
  });

  it('blocks diagnostics for an emission from another company', async () => {
    diagnoseAgent.diagnoseEmission.mockResolvedValue({
      evidence: { empresaCnpj: '99888777000166' },
    });

    await expect(
      controller.diagnoseEmission({ emissionId: 'em-other' }, scopedReq),
    ).rejects.toMatchObject({
      response: { code: 'COMPANY_ACCESS_DENIED' },
    });
  });
});
