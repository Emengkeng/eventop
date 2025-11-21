import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Subscription } from '../entities/subscription.entity';
import { Transaction } from '../entities/transaction.entity';
import { MerchantPlan } from '../entities/merchant-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Transaction, MerchantPlan]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
