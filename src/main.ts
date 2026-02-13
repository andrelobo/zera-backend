import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ApiExceptionFilter } from './common/http/api-exception.filter'
import { correlationIdMiddleware } from './common/http/correlation-id.middleware'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const defaultCorsOrigins = [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://manaus-nfse-dashboard.vercel.app',
  ]
  const envCorsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const corsOrigins = Array.from(new Set([...defaultCorsOrigins, ...envCorsOrigins]))
  const vercelPreviewPattern = /^https:\/\/manaus-nfse-dashboard(?:-[a-z0-9-]+)?\.vercel\.app$/i

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl/postman/server-to-server).
      if (!origin) {
        callback(null, true)
        return
      }

      if (corsOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false)
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
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
