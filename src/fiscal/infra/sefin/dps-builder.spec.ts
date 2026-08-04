import {
  buildDps,
  buildDpsId,
  DPS_NAMESPACE,
  DPS_VERSION,
  DpsBuilderOptions,
  toDateTimeLocal,
} from './dps-builder';

const baseInput = {
  prestador: {
    cnpj: '43521115000134',
    inscricaoMunicipal: '51754301',
    razaoSocial: 'BURGUS LTDA',
    regimeTributarioSn: { opSimpNac: 3, regApTribSN: 1, regEspTrib: 0 },
  },
  tomador: {
    cpfCnpj: '61020788100',
    razaoSocial: 'ANDRE AUGUSTO DE HOLANDA LOBO',
  },
  servico: {
    codigoNacional: '171901',
    codigoTributacao: '100',
    descricao: 'Consulta IR 2024',
    valor: 150,
    iss: { retido: false, aliquota: 5 },
    tributacaoTotal: { pTotTribSN: 6 },
  },
} as const;

const options: DpsBuilderOptions = {
  serie: '1',
  nDPS: '1',
  cLocEmi: '1302603',
};

describe('buildDpsId', () => {
  it('monta TSIdDPS com 45 caracteres (DPS + 42 dígitos)', () => {
    const id = buildDpsId({
      cLocEmi: '1302603',
      cnpjPrestador: '43521115000134',
      serie: '1',
      nDPS: '1',
    });
    expect(id).toMatch(/^DPS\d{42}$/);
    expect(id).toBe(`DPS${'1302603'}${'2'}${'43521115000134'}${'00001'}${'000000000000001'}`);
  });
});

describe('buildDps', () => {
  it('gera XML DPS 1.01 com infDPS/Id e ordem dos campos do XSD', () => {
    const xml = buildDps(baseInput as any, options);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<DPS xmlns="${DPS_NAMESPACE}" versao="${DPS_VERSION}">`);
    const id = buildDpsId({
      cLocEmi: '1302603',
      cnpjPrestador: '43521115000134',
      serie: '1',
      nDPS: '1',
    });
    expect(xml).toContain(`<infDPS Id="${id}">`);

    const infDps = xml.slice(xml.indexOf('<infDPS'), xml.indexOf('</infDPS>'));
    const order = [
      '<tpAmb>',
      '<dhEmi>',
      '<verAplic>',
      '<serie>00001</serie>',
      '<nDPS>1</nDPS>',
      '<dCompet>',
      '<tpEmit>1</tpEmit>',
      '<cLocEmi>1302603</cLocEmi>',
      '<prest>',
      '<toma>',
      '<serv><locPrest>',
      '<cServ>',
      '<valores>',
    ];
    let lastIndex = -1;
    for (const marker of order) {
      const index = infDps.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('monta regTrib a partir do regime do Simples e tributos', () => {
    const xml = buildDps(baseInput as any, options);
    expect(xml).toContain(
      '<regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib>',
    );
    expect(xml).toContain('<cTribNac>171901</cTribNac>');
    expect(xml).toContain('<cTribMun>100</cTribMun>');
    expect(xml).toContain(
      '<valores><vServPrest><vServ>150.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><pTotTribSN>6.00</pTotTribSN></totTrib></trib></valores>',
    );
  });

  it('emite indTotTrib apenas para fora do Simples; ME/EPP exige pTotTribSN (E0712)', () => {
    const xml = buildDps(
      {
        ...baseInput,
        prestador: {
          ...baseInput.prestador,
          regimeTributarioSn: { opSimpNac: 1, regApTribSN: 0, regEspTrib: 0 },
        },
        servico: { ...baseInput.servico, tributacaoTotal: undefined },
      } as any,
      options,
    );
    expect(xml).toContain('<totTrib><indTotTrib>0</indTotTrib></totTrib>');

    const inputSemPTot = {
      ...baseInput,
      servico: { ...baseInput.servico, tributacaoTotal: undefined },
    };
    expect(() => buildDps(inputSemPTot as any, options)).toThrow(
      'ME/EPP (opSimpNac=3) não pode informar indTotTrib',
    );
  });

  it('aceita vTotTrib quando tributacaoTotal possui valores monetarios', () => {
    const xml = buildDps(
      {
        ...baseInput,
        servico: {
          ...baseInput.servico,
          tributacaoTotal: {
            federal: { valor: 5 },
            estadual: { valor: 0 },
            municipal: { valor: 2.01 },
          },
        },
      } as any,
      options,
    );
    expect(xml).toContain(
      '<totTrib><vTotTrib><vTotTribFed>5.00</vTotTribFed><vTotTribEst>0.00</vTotTribEst><vTotTribMun>2.01</vTotTribMun></vTotTrib></totTrib>',
    );
  });

  it('omite pAliq quando Simples Nacional sem retenção (E0625)', () => {
    const xml = buildDps(baseInput as any, options);
    expect(xml).toContain('<tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun>');
    expect(xml).not.toContain('<pAliq>');
  });

  it('emite tpRetISSQN=2 quando o ISS é retido', () => {
    const input = {
      ...baseInput,
      servico: {
        ...baseInput.servico,
        iss: { retido: true, aliquota: 5 },
      },
    };
    const xml = buildDps(input as any, options);
    expect(xml).toContain('<tpRetISSQN>2</tpRetISSQN>');
    expect(xml).toContain('<pAliq>5.0</pAliq>');
  });

  it('aceita CPF no tomador e CNPJ no prestador', () => {
    const xml = buildDps(baseInput as any, options);
    expect(xml).toContain('<toma><CPF>61020788100</CPF>');
    expect(xml).toContain('<prest><CNPJ>43521115000134</CNPJ>');
  });

  it('nao informa xNome do prestador quando o emitente da DPS e o proprio prestador (E0121)', () => {
    const xml = buildDps(baseInput as any, options);
    expect(xml).not.toContain('<xNome>BURGUS LTDA</xNome>');
    expect(xml).toContain('<xNome>ANDRE AUGUSTO DE HOLANDA LOBO</xNome>');
  });

  it('injeta tributos federais e substituição quando presentes', () => {
    const input = {
      ...baseInput,
      substituicao: true,
      idNotaSubstituida: 'NFS' + '1'.repeat(50),
      servico: {
        ...baseInput.servico,
        retencoesFederais: { ir: 10, csll: 5, inss: 3 },
      },
    };
    const xml = buildDps(input as any, options);
    expect(xml).toContain('<subst><chSubstda>');
    expect(xml).toContain('<cMotivo>99</cMotivo>');
    expect(xml).toContain(
      '<tribFed><vRetIRRF>10.00</vRetIRRF><vRetCSLL>5.00</vRetCSLL><vRetCP>3.00</vRetCP></tribFed>',
    );
  });

  it('rejeita CNPJ de prestador com quantidade inválida de dígitos', () => {
    const input = {
      ...baseInput,
      prestador: { ...baseInput.prestador, cnpj: '12345678' },
    };
    expect(() => buildDps(input as any, options)).toThrow('prestador.cnpj deve conter 14 dígitos');
  });

  it('rejeita nDPS com zero à esquerda', () => {
    expect(() => buildDps(baseInput as any, { ...options, nDPS: '0001' })).toThrow(
      'sem zeros à esquerda',
    );
  });

  it('rejeita cLocEmi com quantidade inválida de dígitos', () => {
    expect(() => buildDps(baseInput as any, { ...options, cLocEmi: '13026' })).toThrow('7 dígitos');
  });

  it('usa dCompet da competência quando informada', () => {
    const xml = buildDps(baseInput as any, { ...options, dCompet: '2026-01-21' });
    expect(xml).toContain('<dCompet>2026-01-21</dCompet>');
  });

  it('emite dhEmi em hora local (America/Manaus, -04:00) para nao parecer posterior ao processamento (E0008)', () => {
    const xml = buildDps(baseInput as any, { ...options, dhEmi: '2026-08-03T12:00:00+00:00' });
    expect(xml).toContain('<dhEmi>2026-08-03T08:00:00-04:00</dhEmi>');
    expect(xml).not.toMatch(/<dhEmi>[^<]*\+00:00/);

    const agora = buildDps(baseInput as any, options);
    const dhEmi = /<dhEmi>([^<]+)<\/dhEmi>/.exec(agora)?.[1];
    expect(dhEmi).toBeDefined();
    expect(dhEmi).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-04:00$/);
  });

  it('toDateTimeLocal converte instante para o fuso local padrao', () => {
    expect(toDateTimeLocal('2026-08-03T12:00:00Z')).toBe('2026-08-03T08:00:00-04:00');
    expect(toDateTimeLocal('2026-08-03T12:00:00+00:00')).toBe('2026-08-03T08:00:00-04:00');
  });
});
