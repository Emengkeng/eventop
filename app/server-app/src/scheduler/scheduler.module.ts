import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { SolanaPaymentService } from './solana-payment.service';
import { Subscription } from '../entities/subscription.entity';
import { ScheduledPayment } from '../entities/scheduled-payment.entity';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, ScheduledPayment]),
    ScheduleModule.forRoot(),
    WebhookModule,
  ],
  providers: [PaymentSchedulerService, SolanaPaymentService],
  exports: [PaymentSchedulerService],
})
export class SchedulerModule {}