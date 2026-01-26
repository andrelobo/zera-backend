import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';

import { MongoModule } from './infra/mongo/mongo.module';
import { HealthModule } from './core/health/health.module';

import { FiscalModule } from './modules/fiscal/fiscal.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    MongoModule,
    HealthModule,
    AuthModule,
    UsersModule,
    EmpresasModule,
    FiscalModule,
    WebhooksModule,
  ],
})
export class AppModule {}
