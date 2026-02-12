import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ApiExceptionFilter } from './common/http/api-exception.filter'
import { correlationIdMiddleware } from './common/http/correlation-id.middleware'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const corsOrigins =
    process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ]

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
  app.use(correlationIdMiddleware)
  app.useGlobalFilters(new ApiExceptionFilter())

  const config = new DocumentBuilder()
    .setTitle('ZERA API')
    .setDescription('ZERA Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = process.env.PORT ?? process.env.APP_PORT ?? 3000
  await app.listen(port, '0.0.0.0')
}
bootstrap()
