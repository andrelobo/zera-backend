import {
  Body,
  Controller,
  INestApplication,
  Module,
  Param,
  Patch,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter';
import { correlationIdMiddleware } from '../src/common/http/correlation-id.middleware';
import { CreateEmpresaDto } from '../src/modules/empresas/dtos/create-empresa.dto';
import { UpdateEmpresaDto } from '../src/modules/empresas/dtos/update-empresa.dto';

@Controller('empresas')
class EmpresasValidationController {
  @Post()
  create(@Body() dto: CreateEmpresaDto) {
    return dto;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmpresaDto) {
    return { id, ...dto };
  }
}

@Module({
  controllers: [EmpresasValidationController],
})
class EmpresasValidationModule {}

describe('Empresas Cadastro Validation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EmpresasValidationModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects create without cnpj', async () => {
    const response = await request(app.getHttpServer()).post('/empresas').send({}).expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.message).toContain('cnpj');
    expect(typeof response.body.correlationId).toBe('string');
  });

  it('rejects create with invalid date field', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .send({
        cnpj: '43521115000134',
        dataInicioAtividade: '31/02/2026',
      })
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.message).toContain('dataInicioAtividade');
  });

  it('rejects create with boolean field sent as string', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .send({
        cnpj: '43521115000134',
        opcaoPeloSimples: 'true',
      })
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.message).toContain('opcaoPeloSimples');
  });

  it('rejects create with invalid nested endereco.numero', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .send({
        cnpj: '43521115000134',
        endereco: {
          numero: '',
        },
      })
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.message).toContain('numero');
  });

  it('accepts valid create payload and strips unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .send({
        cnpj: '43521115000134',
        razaoSocial: 'BURGUS LTDA',
        unknownField: 'must-be-removed',
      })
      .expect(201);

    expect(response.body.cnpj).toBe('43521115000134');
    expect(response.body.razaoSocial).toBe('BURGUS LTDA');
    expect(response.body.unknownField).toBeUndefined();
  });

  it('rejects legacy-only payload on create (cpf_cnpj without cnpj)', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .send({
        cpf_cnpj: '43521115000134',
      })
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.message).toContain('cnpj');
  });

  it('rejects patch with invalid number and accepts valid patch', async () => {
    const bad = await request(app.getHttpServer())
      .patch('/empresas/abc123')
      .send({
        capitalSocial: 'abc',
      })
      .expect(400);

    expect(bad.body.code).toBe('BAD_REQUEST');
    expect(bad.body.message).toContain('capitalSocial');

    const good = await request(app.getHttpServer())
      .patch('/empresas/abc123')
      .send({
        inscricaoMunicipal: '51754301',
        capitalSocial: 120000,
      })
      .expect(200);

    expect(good.body.id).toBe('abc123');
    expect(good.body.inscricaoMunicipal).toBe('51754301');
    expect(good.body.capitalSocial).toBe(120000);
  });
});
