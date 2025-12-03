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

// Import all entities explicitly
import { IndexerState } from './entities/indexer-state.entity';
import { MerchantPlan } from './entities/merchant-plan.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionWallet } from './entities/subscription-wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Merchant } from './entities/merchant.entity';
import { ScheduledPayment } from './entities/scheduled-payment.entity';
import { UserProfile } from './entities/user-profile.entity';

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
      // Explicitly list all entities instead of using glob pattern
      entities: [
        IndexerState,
        MerchantPlan,
        Subscription,
        SubscriptionWallet,
        Transaction,
        Merchant,
        ScheduledPayment,
        UserProfile,
      ],
      synchronize: true, // Temporarily force synchronize
      logging: true, // Enable logging to see what's happening
      dropSchema: false, // Don't drop existing data
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
