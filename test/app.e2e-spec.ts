import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Controller, Get, INestApplication, Module } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter';
import { correlationIdMiddleware } from '../src/common/http/correlation-id.middleware';

@Controller()
class TestController {
  @Get()
  getHello() {
    return 'Hello World!';
  }

  @Get('error')
  getError() {
    throw new BadRequestException({
      code: 'TEST_BAD_REQUEST',
      message: 'Synthetic validation error',
      details: { field: 'value' },
    });
  }
}

@Module({
  controllers: [TestController],
})
class TestAppModule {}

describe('Error Contract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('returns standardized error payload with correlationId', async () => {
    const response = await request(app.getHttpServer())
      .get('/error')
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'TEST_BAD_REQUEST',
      message: 'Synthetic validation error',
      details: { field: 'value' },
    });
    expect(typeof response.body.correlationId).toBe('string');
    expect(response.body.correlationId.length).toBeGreaterThan(0);
    expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);
  });
});
