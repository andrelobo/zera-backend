import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import appConfig from './config/app.config'
import databaseConfig from './config/database.config'

import { MongoModule } from './infra/mongo/mongo.module'
import { HealthModule } from './core/health/health.module'

import { FiscalModule } from './modules/fiscal/fiscal.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    MongoModule,
    HealthModule,
    FiscalModule,
    WebhooksModule,
  ],
})
export class AppModule {}
