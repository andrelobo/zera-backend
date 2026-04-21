import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmitirNfseDto } from './emitir-nfse.dto';

describe('EmitirNfseDto', () => {
  it('keeps syncTomadorCadastro so normal emission can skip tomador cadastro sync', async () => {
    const dto = plainToInstance(EmitirNfseDto, {
      syncTomadorCadastro: false,
    });

    const errors = await validate(dto, {
      skipMissingProperties: true,
      whitelist: true,
    });

    expect(errors.find((error) => error.property === 'syncTomadorCadastro')).toBeUndefined();
    expect(dto.syncTomadorCadastro).toBe(false);
  });
});
