import { NfseEmissionStatus } from './types/nfse-emission-status';
import {
  GenericDocumentParser,
  extractDocumentIdentifiers,
  extractProviderStatus,
  mapProviderStatusToDomain,
} from './generic-document-parser';

describe('GenericDocumentParser', () => {
  describe('mapProviderStatusToDomain', () => {
    it('maps concluded to AUTHORIZED', () => {
      expect(mapProviderStatusToDomain('CONCLUIDO')).toBe(NfseEmissionStatus.AUTHORIZED);
    });

    it('maps authorized to AUTHORIZED', () => {
      expect(mapProviderStatusToDomain('AUTORIZADA')).toBe(NfseEmissionStatus.AUTHORIZED);
      expect(mapProviderStatusToDomain('autorizado')).toBe(NfseEmissionStatus.AUTHORIZED);
    });

    it('maps rejected and negada to REJECTED', () => {
      expect(mapProviderStatusToDomain('REJEITADA')).toBe(NfseEmissionStatus.REJECTED);
      expect(mapProviderStatusToDomain('NEGADA')).toBe(NfseEmissionStatus.REJECTED);
    });

    it('maps canceled to CANCELED', () => {
      expect(mapProviderStatusToDomain('CANCELADA')).toBe(NfseEmissionStatus.CANCELED);
    });

    it('maps erro and falha to ERROR', () => {
      expect(mapProviderStatusToDomain('ERRO')).toBe(NfseEmissionStatus.ERROR);
      expect(mapProviderStatusToDomain('FALHA')).toBe(NfseEmissionStatus.ERROR);
    });

    it('keeps PENDING for unknown or empty status', () => {
      expect(mapProviderStatusToDomain('PROCESSANDO')).toBe(NfseEmissionStatus.PENDING);
      expect(mapProviderStatusToDomain(undefined)).toBe(NfseEmissionStatus.PENDING);
    });
  });

  describe('extractProviderStatus', () => {
    it('reads retorno.situacao from single object', () => {
      expect(extractProviderStatus({ retorno: { situacao: 'AUTORIZADA' } })).toBe('AUTORIZADA');
    });

    it('reads status from array payload', () => {
      expect(extractProviderStatus([{ status: 'CONCLUIDO' }])).toBe('CONCLUIDO');
    });

    it('reads flat situation fields', () => {
      expect(extractProviderStatus({ statusNfse: 'REJEITADA' })).toBe('REJEITADA');
    });

    it('returns undefined for empty payload', () => {
      expect(extractProviderStatus({})).toBeUndefined();
    });
  });

  describe('extractDocumentIdentifiers', () => {
    it('extracts numeroNfse from retorno', () => {
      expect(extractDocumentIdentifiers({ retorno: { numeroNfse: '28' } })).toEqual({
        numeroNfse: '28',
      });
    });

    it('extracts dps number and serie', () => {
      expect(extractDocumentIdentifiers({ dps: { numero: 44, serie: '01' } })).toEqual({
        dpsNum: '44',
        serieDpsNum: '01',
      });
    });

    it('extracts from nested documents', () => {
      expect(
        extractDocumentIdentifiers({
          documents: [{ numeroDps: '100', serieDPS: 'A' }],
        }),
      ).toEqual({ dpsNum: '100', serieDpsNum: 'A' });
    });

    it('returns empty object when nothing matches', () => {
      expect(extractDocumentIdentifiers({ foo: 'bar' })).toEqual({});
    });
  });

  describe('GenericDocumentParser class', () => {
    const parser = new GenericDocumentParser();

    it('is named as generic wildcard', () => {
      expect(parser.providerName).toBe('*');
    });

    it('delegates status extraction and mapping', () => {
      expect(parser.extractStatus({ status: 'CONCLUIDO' })).toBe('CONCLUIDO');
      expect(parser.mapStatusToDomain('CONCLUIDO')).toBe(NfseEmissionStatus.AUTHORIZED);
    });
  });
});
