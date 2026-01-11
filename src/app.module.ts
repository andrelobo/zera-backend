import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { MongoModule } from './infra/mongo/mongo.module';
import { HealthModule } from './core/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    MongoModule,
    HealthModule,
  ],
})
export class AppModule {}
