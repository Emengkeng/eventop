import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

import { IndexerModule } from './indexer/indexer.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { MerchantModule } from './merchant/merchant.module';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DB_PORT, DB_NAME, DB_PASSWORD, DB_USER } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(DB_PORT) || 5432,
      username: DB_USER || 'postgres',
      password: DB_PASSWORD || 'password',
      database: DB_NAME || 'subscription_wallet',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: NODE_ENV === 'development',
    }),

    ScheduleModule.forRoot(),

    IndexerModule,
    SubscriptionModule,
    MerchantModule,
    WebhookModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
