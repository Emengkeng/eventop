import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subscription } from '../entities/subscription.entity';
import { ScheduledPayment } from '../entities/scheduled-payment.entity';
import { SolanaPaymentService } from './solana-payment.service';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,

    @InjectRepository(ScheduledPayment)
    private scheduledPaymentRepo: Repository<ScheduledPayment>,

    private solanaPaymentService: SolanaPaymentService,
    private webhookService: WebhookService,
  ) {}

  /**
   * Schedule next payment for a subscription
   */
  async scheduleNextPayment(subscription: Subscription) {
    const lastPaymentTime = parseInt(subscription.lastPaymentTimestamp);
    const interval = parseInt(subscription.paymentInterval);
    const nextPaymentTime = lastPaymentTime + interval;

    const scheduledPayment = this.scheduledPaymentRepo.create({
      subscriptionPda: subscription.subscriptionPda,
      merchantWallet: subscription.merchantWallet,
      amount: subscription.feeAmount,
      scheduledFor: new Date(nextPaymentTime * 1000),
      status: 'pending',
    });

    await this.scheduledPaymentRepo.save(scheduledPayment);

    this.logger.log(
      `📅 Scheduled payment for ${subscription.subscriptionPda} at ${scheduledPayment.scheduledFor.toISOString()}`,
    );
  }

  /**
   * Process due payments every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDuePayments() {
    if (this.isProcessing) {
      this.logger.warn('Payment processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Get all pending payments that are due
      const duePayments = await this.scheduledPaymentRepo.find({
        where: {
          status: 'pending',
          scheduledFor: LessThan(new Date()),
        },
        take: 50, // Process in batches
      });

      if (duePayments.length === 0) {
        return;
      }

      this.logger.log(`⚡ Processing ${duePayments.length} due payments...`);

      // Process payments in parallel (with concurrency limit)
      const results = await Promise.allSettled(
        duePayments.map((payment) => this.executePayment(payment)),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(`✅ Completed: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      this.logger.error('Error processing payments:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single payment
   */
  private async executePayment(scheduledPayment: ScheduledPayment) {
    try {
      // Mark as processing
      scheduledPayment.status = 'processing';
      await this.scheduledPaymentRepo.save(scheduledPayment);

      // Get subscription details
      const subscription = await this.subscriptionRepo.findOne({
        where: { subscriptionPda: scheduledPayment.subscriptionPda },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!subscription.isActive) {
        scheduledPayment.status = 'failed';
        scheduledPayment.errorMessage = 'Subscription is not active';
        await this.scheduledPaymentRepo.save(scheduledPayment);
        return;
      }

      // Execute payment on Solana
      this.logger.log(
        `💸 Executing payment for ${subscription.subscriptionPda}`,
      );

      const result = await this.solanaPaymentService.executePayment(
        subscription.subscriptionPda,
        subscription.subscriptionWalletPda,
        subscription.merchantWallet,
        subscription.feeAmount,
      );

      if (result.success) {
        // Update scheduled payment
        scheduledPayment.status = 'completed';
        scheduledPayment.signature = result.signature ?? '';
        scheduledPayment.executedAt = new Date();
        await this.scheduledPaymentRepo.save(scheduledPayment);

        // Update subscription
        subscription.lastPaymentTimestamp = (Date.now() / 1000).toString();
        subscription.totalPaid = (
          BigInt(subscription.totalPaid) + BigInt(subscription.feeAmount)
        ).toString();
        subscription.paymentCount += 1;
        await this.subscriptionRepo.save(subscription);

        // Schedule next payment
        await this.scheduleNextPayment(subscription);

        // Send webhook
        await this.webhookService.notifyPaymentExecuted({
          subscriptionPda: subscription.subscriptionPda,
          userWallet: subscription.userWallet,
          merchantWallet: subscription.merchantWallet,
          amount: subscription.feeAmount,
          paymentNumber: subscription.paymentCount,
        });

        this.logger.log(`✅ Payment executed: ${result.signature ?? ''}`);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Payment failed for ${scheduledPayment.subscriptionPda}:`,
        error,
      );

      // Update scheduled payment with error
      scheduledPayment.status = 'failed';
      scheduledPayment.errorMessage = errorMessage;
      scheduledPayment.retryCount += 1;

      // Retry logic: Reschedule if retry count < 3
      if (scheduledPayment.retryCount < 3) {
        scheduledPayment.status = 'pending';
        scheduledPayment.scheduledFor = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
        this.logger.log(
          `🔄 Rescheduling payment for retry (${scheduledPayment.retryCount}/3)`,
        );
      } else {
        // Max retries reached, notify merchant of failure
        const subscription = await this.subscriptionRepo.findOne({
          where: { subscriptionPda: scheduledPayment.subscriptionPda },
        });

        if (subscription) {
          await this.webhookService.notifyPaymentFailed({
            subscriptionPda: subscription.subscriptionPda,
            userWallet: subscription.userWallet,
            merchantWallet: subscription.merchantWallet,
            amountRequired: subscription.feeAmount,
            balanceAvailable: '0', // Would need to query on-chain balance
            failureCount: scheduledPayment.retryCount,
          });
        }
      }

      await this.scheduledPaymentRepo.save(scheduledPayment);
    }
  }

  /**
   * Cancel scheduled payments for a subscription
   */
  async cancelScheduledPayments(subscriptionPda: string) {
    await this.scheduledPaymentRepo.update(
      {
        subscriptionPda,
        status: 'pending',
      },
      {
        status: 'cancelled',
      },
    );

    this.logger.log(`🚫 Cancelled scheduled payments for ${subscriptionPda}`);
  }
}
