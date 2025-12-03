import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { IndexerModule } from './indexer/indexer.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { MerchantModule } from './merchant/merchant.module';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, // Global module for Prisma
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
