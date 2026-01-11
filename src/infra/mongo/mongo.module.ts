import { Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('database.mongoUri');
        const logger = new Logger('MongoDB');

        return {
          uri,
          connectionFactory: (connection) => {
            logger.log('MongoDB connected successfully');
            connection.on('error', (err) => {
              logger.error('MongoDB connection error', err);
            });
            return connection;
          },
        };
      },
    }),
  ],
})
export class MongoModule {}
