import { BadRequestException } from '@nestjs/common';
import { TomadoresService } from './tomadores.service';

describe('TomadoresService', () => {
  it('lookupCpf rejects invalid cpf', async () => {
    const service = new TomadoresService({} as any, { consultarCpf: jest.fn() } as any);

    await expect(service.lookupCpf({ cpf: '123' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lookupCpf normalizes useful data from HubDev response', async () => {
    const hubdev = {
      consultarCpf: jest.fn().mockResolvedValue({
        nomeCompleto: 'Andre Lobo',
        dataDeNascimento: '1988-01-01',
        nomeDaMae: 'Maria Lobo',
        genero: 'M',
        listaEmails: [{ email: 'andre@zera.app' }],
        listaTelefones: [{ ddd: '92', numero: '991234567' }],
        listaEnderecos: [{
          cep: '69010040',
          logradouro: 'Rua Saldanha Marinho',
          numero: '606',
          complemento: 'Sala 255',
          bairro: 'Centro',
          cidade: 'Manaus',
          uf: 'AM',
        }],
        lastUpdate: '2026-04-16',
      }),
    };
    const service = new TomadoresService({} as any, hubdev as any);

    const result = await service.lookupCpf({ cpf: '610.207.881-00' });

    expect(hubdev.consultarCpf).toHaveBeenCalledWith('61020788100');
    expect(result).toEqual({
      cpf: '61020788100',
      source: 'hubdev_cadastropf',
      found: true,
      usefulData: true,
      maskedByLgpd: false,
      nome: 'Andre Lobo',
      dataNascimento: '1988-01-01',
      nomeMae: 'Maria Lobo',
      genero: 'M',
      email: 'andre@zera.app',
      whatsapp: '92991234567',
      telefone: '92991234567',
      endereco: {
        cep: '69010040',
        logradouro: 'Rua Saldanha Marinho',
        numero: '606',
        complemento: 'Sala 255',
        bairro: 'Centro',
        municipio: 'Manaus',
        uf: 'AM',
      },
      lastUpdate: '2026-04-16',
    });
  });

  it('lookupCpf flags masked LGPD payload without inventing fields', async () => {
    const hubdev = {
      consultarCpf: jest.fn().mockResolvedValue({
        listaEmails: [{ email: 'an***@gm***.com' }],
        listaTelefones: [{ ddd: '92', numero: '99*****67' }],
        listaEnderecos: [{
          cep: '69***040',
          logradouro: 'Rua ***',
          cidade: 'Manaus',
          uf: '**',
        }],
      }),
    };
    const service = new TomadoresService({} as any, hubdev as any);

    const result = await service.lookupCpf({ cpf: '61020788100' });

    expect(result).toMatchObject({
      cpf: '61020788100',
      source: 'hubdev_cadastropf',
      found: true,
      usefulData: false,
      maskedByLgpd: true,
    });
    expect(result.email).toBeUndefined();
    expect(result.telefone).toBeUndefined();
    expect(result.endereco).toBeUndefined();
  });
  it('rejects invalid empresaCnpj', async () => {
    const model = {
      create: jest.fn(),
    };
    const service = new TomadoresService(model as any, { consultarCpf: jest.fn() } as any);

    await expect(
      service.create({
        empresaCnpj: '123',
        cpfCnpj: '61020788100',
        razaoSocial: 'Cliente',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate key error to business code', async () => {
    const model = {
      create: jest.fn().mockRejectedValue({ code: 11000 }),
    };
    const service = new TomadoresService(model as any, { consultarCpf: jest.fn() } as any);

    await expect(
      service.create({
        empresaCnpj: '43521115000134',
        cpfCnpj: '61020788100',
        razaoSocial: 'Cliente',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'TOMADOR_ALREADY_EXISTS_FOR_EMPRESA',
      },
    });
  });

  it('autocomplete finds by cpf/cnpj digits and clamps limit to 50', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const model = { find };
    const service = new TomadoresService(model as any, { consultarCpf: jest.fn() } as any);

    await service.autocomplete({
      empresaCnpj: '43.521.115/0001-34',
      q: '610.207.881-00',
      limit: 999,
    });

    expect(find).toHaveBeenCalledWith(
      {
        empresaCnpj: '43521115000134',
        $or: [
          { razaoSocial: { $regex: '610.207.881-00', $options: 'i' } },
          { cpfCnpj: { $regex: '61020788100', $options: 'i' } },
        ],
      },
      {
        empresaCnpj: 1,
        cpfCnpj: 1,
        razaoSocial: 1,
        nomeFantasia: 1,
        inscricaoMunicipal: 1,
        inscricaoEstadual: 1,
        suframa: 1,
        substitutoTributario: 1,
        whatsapp: 1,
        email: 1,
        endereco: 1,
        servicos: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    );
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
    expect(limit).toHaveBeenCalledWith(50);
  });

  it('autocomplete finds by name and uses default limit 10', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const model = { find };
    const service = new TomadoresService(model as any, { consultarCpf: jest.fn() } as any);

    await service.autocomplete({
      empresaCnpj: '43521115000134',
      q: 'Andre Lobo',
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        empresaCnpj: '43521115000134',
        $or: [
          { razaoSocial: { $regex: 'Andre Lobo', $options: 'i' } },
          { cpfCnpj: { $regex: 'Andre Lobo', $options: 'i' } },
        ],
      }),
      expect.any(Object),
    );
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('autocomplete rejects invalid empresaCnpj', async () => {
    const model = { find: jest.fn() };
    const service = new TomadoresService(model as any, { consultarCpf: jest.fn() } as any);

    await expect(
      service.autocomplete({
        empresaCnpj: '123',
        q: 'andre',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('autocomplete accepts empty q and returns most recent by empresa', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const model = { find };
    const service = new TomadoresService(model as any, { consultarCpf: jest.fn() } as any);

    await service.autocomplete({
      empresaCnpj: '43521115000134',
      q: '   ',
    });

    expect(find).toHaveBeenCalledWith({ empresaCnpj: '43521115000134' }, expect.any(Object));
    expect(limit).toHaveBeenCalledWith(10);
  });
});
