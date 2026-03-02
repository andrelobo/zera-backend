import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter';
import { correlationIdMiddleware } from '../src/common/http/correlation-id.middleware';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { Roles } from '../src/modules/auth/guards/roles.decorator';

class FakeJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { id: string; email: string; role: string };
      header: (name: string) => string | undefined;
    }>();
    const role = req.header('x-test-role');
    if (!role) return false;
    req.user = {
      id: 'tester-1',
      email: 'tester@zera.local',
      role,
    };
    return true;
  }
}

@Controller('empresas')
@UseGuards(FakeJwtAuthGuard, RolesGuard)
class EmpresasAuthzController {
  @Post()
  @Roles('admin')
  create(@Body() body: Record<string, unknown>) {
    return { ok: true, action: 'create', body };
  }

  @Patch(':id')
  @Roles('admin')
  update(@Body() body: Record<string, unknown>) {
    return { ok: true, action: 'update', body };
  }

  @Get()
  @Roles('admin', 'manager', 'user')
  list() {
    return [{ id: 'empresa-1' }];
  }
}

describe('Empresas Authorization (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EmpresasAuthzController],
      providers: [Reflector, RolesGuard, FakeJwtAuthGuard],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows admin to create empresa', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .set('x-test-role', 'admin')
      .send({ cnpj: '43521115000134' })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.action).toBe('create');
  });

  it('blocks manager from creating empresa', async () => {
    const response = await request(app.getHttpServer())
      .post('/empresas')
      .set('x-test-role', 'manager')
      .send({ cnpj: '43521115000134' })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('allows manager to list empresas', async () => {
    const response = await request(app.getHttpServer())
      .get('/empresas')
      .set('x-test-role', 'manager')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('blocks user from patching empresa', async () => {
    const response = await request(app.getHttpServer())
      .patch('/empresas/empresa-1')
      .set('x-test-role', 'user')
      .send({ inscricaoMunicipal: '51754301' })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('allows admin to patch empresa', async () => {
    const response = await request(app.getHttpServer())
      .patch('/empresas/empresa-1')
      .set('x-test-role', 'admin')
      .send({ inscricaoMunicipal: '51754301' })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.action).toBe('update');
  });
});
