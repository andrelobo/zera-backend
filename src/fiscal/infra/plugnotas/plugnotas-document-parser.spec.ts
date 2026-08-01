import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import { PlugNotasDocumentParser } from './plugnotas-document-parser';
import {
  extractPlugNotasDocumentIdentifiers,
  extractPlugNotasStatus,
  mapPlugNotasStatusToDomain,
} from './nfse.mapper';

describe('PlugNotasDocumentParser', () => {
  it('is named PLUGNOTAS and inherits canonical parsing', () => {
    const parser = new PlugNotasDocumentParser();
    expect(parser.providerName).toBe('PLUGNOTAS');
    expect(parser.extractStatus([{ status: 'CONCLUIDO' }])).toBe('CONCLUIDO');
    expect(parser.mapStatusToDomain('CONCLUIDO')).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parser.extractDocumentIdentifiers({ dps: { numero: 44, serie: '01' } })).toEqual({
      dpsNum: '44',
      serieDpsNum: '01',
    });
  });
});

describe('nfse.mapper compat exports', () => {
  it('keeps mapPlugNotasStatusToDomain behavior', () => {
    expect(mapPlugNotasStatusToDomain('AUTORIZADA')).toBe(NfseEmissionStatus.AUTHORIZED);
  });

  it('keeps extractPlugNotasStatus behavior', () => {
    expect(extractPlugNotasStatus({ retorno: { situacao: 'REJEITADA' } })).toBe('REJEITADA');
  });

  it('keeps extractPlugNotasDocumentIdentifiers behavior', () => {
    expect(
      extractPlugNotasDocumentIdentifiers({
        retorno: { numeroNfse: '28' },
        dps: { numero: 41, serie: '01' },
      }),
    ).toEqual({ numeroNfse: '28', dpsNum: '41', serieDpsNum: '01' });
  });
});
