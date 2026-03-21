import { extractPlugNotasDocumentIdentifiers } from './nfse.mapper';

describe('nfse.mapper', () => {
  it('extracts portal nacional identifiers from dps payload in provider response', () => {
    expect(
      extractPlugNotasDocumentIdentifiers({
        dps: {
          numero: 38,
          serie: '01',
          id: 'DPS130260324352111500013400001000000000000038',
        },
        retorno: {
          numeroNfse: 1001,
        },
      }),
    ).toEqual({
      numeroNfse: '1001',
      dpsNum: '38',
      serieDpsNum: '01',
    });
  });
});
