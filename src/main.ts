import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { correlationIdMiddleware } from './common/http/correlation-id.middleware';
import { requestLoggingMiddleware } from './common/http/request-logging.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const defaultCorsOrigins = [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://manaus-nfse-dashboard.vercel.app',
  ];
  const envCorsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigins = Array.from(new Set([...defaultCorsOrigins, ...envCorsOrigins]));
  const vercelPreviewPattern = /^https:\/\/manaus-nfse-dashboard(?:-[a-z0-9-]+)?\.vercel\.app$/i;

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl/postman/server-to-server).
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    credentials: true,
  });

  app.use(correlationIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerServerUrl =
    process.env.SWAGGER_SERVER_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();

  const docBuilder = new DocumentBuilder()
    .setTitle('ZERA API')
    .setDescription('ZERA Backend API')
    .setVersion('1.0')
    .addBearerAuth();

  if (swaggerServerUrl) {
    docBuilder.addServer(swaggerServerUrl);
    logger.log(`Swagger server url configured: ${swaggerServerUrl}`);
  }

  const config = docBuilder.build();

  let serializedOpenApi = '';
  let document = SwaggerModule.createDocument(app, config);

  try {
    serializedOpenApi = JSON.stringify(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Swagger serialization failed. Falling back to minimal OpenAPI doc. error=${message}`,
    );
    document = {
      openapi: '3.0.0',
      info: {
        title: 'ZERA API',
        version: '1.0',
        description: 'Fallback document due to serialization error',
      },
      paths: {},
    } as any;
    serializedOpenApi = JSON.stringify(document);
  }

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs-json', (_req: any, res: any) => {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.send(serializedOpenApi);
  });

  SwaggerModule.setup('docs', app, JSON.parse(serializedOpenApi), {
    jsonDocumentUrl: 'docs-json',
  });
  logger.log('Swagger available at /docs and /docs-json');

  const port = process.env.PORT ?? process.env.APP_PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
