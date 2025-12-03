import { Module } from '@nestjs/common';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { SolanaPaymentService } from './solana-payment.service';

@Module({
  providers: [PaymentSchedulerService, SolanaPaymentService],
  exports: [PaymentSchedulerService],
})
export class SchedulerModule {}
