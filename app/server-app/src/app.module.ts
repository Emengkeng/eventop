/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

import { IndexerModule } from './indexer/indexer.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { MerchantModule } from './merchant/merchant.module';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import {
  DB_PORT,
  DB_NAME,
  DB_HOST,
  DB_PASSWORD,
  DB_USER,
  NODE_ENV,
} from './config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: DB_HOST,
      port: parseInt(DB_PORT!),
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: NODE_ENV === 'development',
    }),

    ScheduleModule.forRoot(),

    IndexerModule,
    SubscriptionModule,
    MerchantModule,
    WebhookModule,
    AnalyticsModule,
    AuthModule,
    RateLimitModule,
  ],
})
export class AppModule {}
