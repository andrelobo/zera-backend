import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { DiagnoseAgent } from './diagnose.agent';

describe('DiagnoseAgent', () => {
  function makeEmission(overrides: Record<string, any> = {}) {
    return {
      _id: { toString: () => 'em-001' },
      status: NfseEmissionStatus.PENDING,
      externalId: 'ext-001',
      error: null,
      providerResponse: null,
      xmlBase64: null,
      pdfBase64: null,
      ...overrides,
    } as any;
  }

  function makeAgent(input?: {
    emission?: any;
    lastAudit?: any;
    lastSuccess?: any;
    lastFailure?: any;
  }) {
    const emissionValue = input && 'emission' in input ? input.emission : makeEmission();
    const emissions = {
      findById: jest.fn().mockResolvedValue(emissionValue),
      findByExternalId: jest.fn().mockResolvedValue(emissionValue),
    };
    const webhookAudits = {
      getLatestByRoute: jest.fn().mockResolvedValue(input?.lastAudit ?? null),
      getLatestSuccessByRoute: jest.fn().mockResolvedValue(input?.lastSuccess ?? null),
      getLatestFailureByRoute: jest.fn().mockResolvedValue(input?.lastFailure ?? null),
    };

    return {
      agent: new DiagnoseAgent(emissions as any, webhookAudits as any),
      emissions,
      webhookAudits,
    };
  }

  it('diagnoses webhook healthy emissions as low severity', async () => {
    const { agent } = makeAgent({
      emission: makeEmission({
        status: NfseEmissionStatus.AUTHORIZED,
        xmlBase64: 'xml',
        pdfBase64: 'pdf',
        lastUpdateSource: 'webhook',
        lastWebhookAt: new Date('2026-05-11T12:00:00.000Z'),
        pollAttempts: 0,
      }),
    });

    const out = await agent.diagnoseEmission({ emissionId: '680a7fb7b68434370d8a4cd2' });

    expect(out.severity).toBe('low');
    expect(out.probableLayer).toBe('webhook');
    expect(out.probableCause).toBe('webhook_operational');
  });

  it('diagnoses authorized emissions closed by polling as webhook attention point', async () => {
    const { agent } = makeAgent({
      emission: makeEmission({
        status: NfseEmissionStatus.AUTHORIZED,
        xmlBase64: 'xml',
        pdfBase64: 'pdf',
        lastUpdateSource: 'polling',
        pollAttempts: 3,
        lastPolledAt: new Date('2026-05-11T12:01:00.000Z'),
      }),
    });

    const out = await agent.diagnoseEmission({ externalId: 'ext-001' });

    expect(out.severity).toBe('medium');
    expect(out.probableLayer).toBe('webhook');
    expect(out.probableCause).toBe('webhook_not_confirmed_for_this_emission');
  });

  it('diagnoses provider outage from transient availability message', async () => {
    const { agent } = makeAgent({
      emission: makeEmission({
        status: NfseEmissionStatus.ERROR,
        error: 'NFSe Nacional indisponível temporariamente. Tente novamente mais tarde.',
      }),
    });

    const out = await agent.diagnoseEmission({ externalId: 'ext-001' });

    expect(out.severity).toBe('high');
    expect(out.probableLayer).toBe('provider');
    expect(out.probableCause).toBe('provider_temporarily_unavailable');
  });

  it('diagnoses invalid shared secret when latest webhook failure indicates token mismatch', async () => {
    const { agent } = makeAgent({
      emission: makeEmission({
        status: NfseEmissionStatus.PENDING,
        pollAttempts: 1,
      }),
      lastFailure: {
        reason: 'invalid_shared_secret',
        tokenAccepted: false,
      },
    });

    const out = await agent.diagnoseEmission({ externalId: 'ext-001' });

    expect(out.severity).toBe('high');
    expect(out.probableLayer).toBe('webhook');
    expect(out.probableCause).toBe('invalid_shared_secret');
    expect(out.evidence.latestWebhookAuditTokenAccepted).toBe(false);
  });

  it('rejects empty diagnosis input', async () => {
    const { agent } = makeAgent();

    await expect(agent.diagnoseEmission({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found when emission does not exist', async () => {
    const { agent } = makeAgent({ emission: null });

    await expect(
      agent.diagnoseEmission({ emissionId: '680a7fb7b68434370d8a4cd2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
