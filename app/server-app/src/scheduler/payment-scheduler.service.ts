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
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MINUTES = 5;
  private readonly BATCH_SIZE = 50;

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
  async scheduleNextPayment(subscription: Subscription): Promise<void> {
    try {
      const lastPaymentTime = parseInt(subscription.lastPaymentTimestamp);
      const interval = parseInt(subscription.paymentInterval);
      const nextPaymentTime = lastPaymentTime + interval;

      // Check if a payment is already scheduled
      const existingPayment = await this.scheduledPaymentRepo.findOne({
        where: {
          subscriptionPda: subscription.subscriptionPda,
          status: 'pending',
        },
      });

      if (existingPayment) {
        this.logger.warn(
          `Payment already scheduled for ${subscription.subscriptionPda}`,
        );
        return;
      }

      const scheduledPayment = this.scheduledPaymentRepo.create({
        subscriptionPda: subscription.subscriptionPda,
        merchantWallet: subscription.merchantWallet,
        amount: subscription.feeAmount,
        scheduledFor: new Date(nextPaymentTime * 1000),
        status: 'pending',
        retryCount: 0,
        errorMessage: undefined,
      });

      await this.scheduledPaymentRepo.save(scheduledPayment);

      this.logger.log(
        `Scheduled payment for ${subscription.subscriptionPda} at ${scheduledPayment.scheduledFor.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Failed to schedule payment:', error);
      throw error;
    }
  }

  /**
   * Process due payments every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDuePayments(): Promise<void> {
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
        take: this.BATCH_SIZE,
        order: {
          scheduledFor: 'ASC',
        },
      });

      if (duePayments.length === 0) {
        return;
      }

      this.logger.log(`Processing ${duePayments.length} due payments...`);

      // Process payments sequentially to avoid rate limits
      let succeeded = 0;
      let failed = 0;

      for (const payment of duePayments) {
        try {
          await this.executePayment(payment);
          succeeded++;
        } catch (error) {
          failed++;
          this.logger.error(`Failed to process payment ${payment.id}:`, error);
        }
        // Small delay between payments to avoid overwhelming the RPC
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

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
  private async executePayment(
    scheduledPayment: ScheduledPayment,
  ): Promise<void> {
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

      // SECURITY: Verify merchant matches before payment
      if (subscription.merchantWallet !== scheduledPayment.merchantWallet) {
        throw new Error(
          `Merchant mismatch: subscription=${subscription.merchantWallet}, payment=${scheduledPayment.merchantWallet}`,
        );
      }

      // Verify subscription on-chain before executing
      const verification = await this.solanaPaymentService.verifySubscription(
        subscription.subscriptionPda,
      );

      if (!verification.isValid) {
        throw new Error(
          verification.error || 'Subscription verification failed',
        );
      }

      // Execute payment on Solana
      this.logger.log(`Executing payment for ${subscription.subscriptionPda}`);

      const result = await this.solanaPaymentService.executePayment(
        subscription.subscriptionPda,
        subscription.subscriptionWalletPda,
        subscription.merchantWallet,
      );

      if (result.success) {
        // Update scheduled payment
        scheduledPayment.status = 'completed';
        scheduledPayment.signature = result.signature || '';
        scheduledPayment.executedAt = new Date();
        await this.scheduledPaymentRepo.save(scheduledPayment);

        // Update subscription
        const currentTimestamp = Math.floor(Date.now() / 1000);
        subscription.lastPaymentTimestamp = currentTimestamp.toString();
        subscription.totalPaid = (
          BigInt(subscription.totalPaid) + BigInt(subscription.feeAmount)
        ).toString();
        subscription.paymentCount += 1;
        await this.subscriptionRepo.save(subscription);

        // Schedule next payment
        await this.scheduleNextPayment(subscription);

        // Send webhook
        await this.webhookService
          .notifyPaymentExecuted({
            subscriptionPda: subscription.subscriptionPda,
            userWallet: subscription.userWallet,
            merchantWallet: subscription.merchantWallet,
            amount: subscription.feeAmount,
            paymentNumber: subscription.paymentCount,
            // signature: result.signature || '',
            // timestamp: currentTimestamp,
          })
          .catch((error: Error) => {
            this.logger.error('Webhook notification failed:', error);
            // Don't fail the payment if webhook fails
          });

        this.logger.log(`✅ Payment executed: ${result.signature || ''}`);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Payment failed for ${scheduledPayment.subscriptionPda}:`,
        error,
      );

      // Update scheduled payment with error
      scheduledPayment.status = 'failed';
      scheduledPayment.errorMessage = errorMessage;
      scheduledPayment.retryCount += 1;

      // Retry logic: Reschedule if retry count < MAX_RETRIES
      if (scheduledPayment.retryCount < this.MAX_RETRIES) {
        scheduledPayment.status = 'pending';
        scheduledPayment.scheduledFor = new Date(
          Date.now() + this.RETRY_DELAY_MINUTES * 60 * 1000,
        );
        this.logger.log(
          `🔄 Rescheduling payment for retry (${scheduledPayment.retryCount}/${this.MAX_RETRIES})`,
        );
      } else {
        // Max retries reached, notify merchant of failure
        const subscription = await this.subscriptionRepo.findOne({
          where: { subscriptionPda: scheduledPayment.subscriptionPda },
        });

        if (subscription) {
          await this.webhookService
            .notifyPaymentFailed({
              subscriptionPda: subscription.subscriptionPda,
              userWallet: subscription.userWallet,
              merchantWallet: subscription.merchantWallet,
              amountRequired: subscription.feeAmount,
              balanceAvailable: '0',
              failureCount: scheduledPayment.retryCount,
              // errorMessage: errorMessage,
            })
            .catch((error: Error) => {
              this.logger.error('Failed webhook notification:', error);
            });
        }
      }

      await this.scheduledPaymentRepo.save(scheduledPayment);
    }
  }

  /**
   * Cancel scheduled payments for a subscription
   */
  async cancelScheduledPayments(subscriptionPda: string): Promise<void> {
    try {
      const result = await this.scheduledPaymentRepo.update(
        {
          subscriptionPda,
          status: 'pending',
        },
        {
          status: 'cancelled',
        },
      );

      this.logger.log(
        `Cancelled ${result.affected || 0} scheduled payments for ${subscriptionPda}`,
      );
    } catch (error) {
      this.logger.error('Failed to cancel scheduled payments:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.scheduledPaymentRepo.count({ where: { status: 'pending' } }),
      this.scheduledPaymentRepo.count({ where: { status: 'processing' } }),
      this.scheduledPaymentRepo.count({ where: { status: 'completed' } }),
      this.scheduledPaymentRepo.count({ where: { status: 'failed' } }),
    ]);

    return { pending, processing, completed, failed };
  }

  /**
   * Cleanup old completed payments (for maintenance)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldPayments(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.scheduledPaymentRepo.delete({
        status: 'completed',
        executedAt: LessThan(thirtyDaysAgo),
      });

      this.logger.log(`Cleaned up ${result.affected || 0} old payments`);
    } catch (error) {
      this.logger.error('Failed to cleanup old payments:', error);
    }
  }
}
