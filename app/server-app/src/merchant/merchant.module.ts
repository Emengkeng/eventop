import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { Merchant } from '../entities/merchant.entity';
import { MerchantPlan } from '../entities/merchant-plan.entity';
import { Subscription } from '../entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, MerchantPlan, Subscription])],
  controllers: [MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
