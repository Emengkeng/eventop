import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SolanaPaymentService } from './solana-payment.service';
import { WebhookService } from '../webhook/webhook.service';
import { ScheduledPayment, Subscription } from '../generated/client';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);
  private isProcessing = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MINUTES = 5;
  private readonly BATCH_SIZE = 50;

  constructor(
    private prisma: PrismaService,
    private solanaPaymentService: SolanaPaymentService,
    private webhookService: WebhookService,
  ) {}

  async scheduleNextPayment(subscription: Subscription): Promise<void> {
    try {
      const lastPaymentTime = parseInt(subscription.lastPaymentTimestamp);
      const interval = parseInt(subscription.paymentInterval);
      const nextPaymentTime = lastPaymentTime + interval;

      const existingPayment = await this.prisma.scheduledPayment.findFirst({
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

      await this.prisma.scheduledPayment.create({
        data: {
          subscriptionPda: subscription.subscriptionPda,
          merchantWallet: subscription.merchantWallet,
          amount: subscription.feeAmount,
          scheduledFor: new Date(nextPaymentTime * 1000),
          status: 'pending',
          retryCount: 0,
        },
      });

      this.logger.log(
        `Scheduled payment for ${subscription.subscriptionPda} at ${new Date(nextPaymentTime * 1000).toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Failed to schedule payment:', error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDuePayments(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Payment processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const duePayments = await this.prisma.scheduledPayment.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lt: new Date(),
          },
        },
        take: this.BATCH_SIZE,
        orderBy: {
          scheduledFor: 'asc',
        },
      });

      if (duePayments.length === 0) {
        return;
      }

      this.logger.log(`Processing ${duePayments.length} due payments...`);

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
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.logger.log(`✅ Completed: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      this.logger.error('Error processing payments:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executePayment(
    scheduledPayment: ScheduledPayment,
  ): Promise<void> {
    try {
      await this.prisma.scheduledPayment.update({
        where: { id: scheduledPayment.id },
        data: { status: 'processing' },
      });

      const subscription = await this.prisma.subscription.findUnique({
        where: { subscriptionPda: scheduledPayment.subscriptionPda },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!subscription.isActive) {
        await this.prisma.scheduledPayment.update({
          where: { id: scheduledPayment.id },
          data: {
            status: 'failed',
            errorMessage: 'Subscription is not active',
          },
        });
        return;
      }

      if (subscription.merchantWallet !== scheduledPayment.merchantWallet) {
        throw new Error(
          `Merchant mismatch: subscription=${subscription.merchantWallet}, payment=${scheduledPayment.merchantWallet}`,
        );
      }

      const verification = await this.solanaPaymentService.verifySubscription(
        subscription.subscriptionPda,
      );

      if (!verification.isValid) {
        throw new Error(
          verification.error || 'Subscription verification failed',
        );
      }

      this.logger.log(`Executing payment for ${subscription.subscriptionPda}`);

      const result = await this.solanaPaymentService.executePayment(
        subscription.subscriptionPda,
        subscription.subscriptionWalletPda,
        subscription.merchantWallet,
      );

      if (result.success) {
        await this.prisma.scheduledPayment.update({
          where: { id: scheduledPayment.id },
          data: {
            status: 'completed',
            signature: result.signature || '',
            executedAt: new Date(),
          },
        });

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const newTotalPaid = (
          BigInt(subscription.totalPaid) + BigInt(subscription.feeAmount)
        ).toString();

        await this.prisma.subscription.update({
          where: { subscriptionPda: subscription.subscriptionPda },
          data: {
            lastPaymentTimestamp: currentTimestamp.toString(),
            totalPaid: newTotalPaid,
            paymentCount: { increment: 1 },
          },
        });

        await this.scheduleNextPayment(subscription);

        await this.webhookService
          .notifyPaymentExecuted({
            subscriptionPda: subscription.subscriptionPda,
            userWallet: subscription.userWallet,
            merchantWallet: subscription.merchantWallet,
            amount: subscription.feeAmount,
            paymentNumber: subscription.paymentCount + 1,
          })
          .catch((error: Error) => {
            this.logger.error('Webhook notification failed:', error);
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

      const retryCount = scheduledPayment.retryCount + 1;

      if (retryCount < this.MAX_RETRIES) {
        await this.prisma.scheduledPayment.update({
          where: { id: scheduledPayment.id },
          data: {
            status: 'pending',
            errorMessage,
            retryCount,
            scheduledFor: new Date(
              Date.now() + this.RETRY_DELAY_MINUTES * 60 * 1000,
            ),
          },
        });
        this.logger.log(
          `🔄 Rescheduling payment for retry (${retryCount}/${this.MAX_RETRIES})`,
        );
      } else {
        await this.prisma.scheduledPayment.update({
          where: { id: scheduledPayment.id },
          data: {
            status: 'failed',
            errorMessage,
            retryCount,
          },
        });

        const subscription = await this.prisma.subscription.findUnique({
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
              failureCount: retryCount,
            })
            .catch((error: Error) => {
              this.logger.error('Failed webhook notification:', error);
            });
        }
      }
    }
  }

  async cancelScheduledPayments(subscriptionPda: string): Promise<void> {
    try {
      const result = await this.prisma.scheduledPayment.updateMany({
        where: {
          subscriptionPda,
          status: 'pending',
        },
        data: {
          status: 'cancelled',
        },
      });

      this.logger.log(
        `Cancelled ${result.count} scheduled payments for ${subscriptionPda}`,
      );
    } catch (error) {
      this.logger.error('Failed to cancel scheduled payments:', error);
      throw error;
    }
  }

  async getPaymentStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.prisma.scheduledPayment.count({ where: { status: 'pending' } }),
      this.prisma.scheduledPayment.count({ where: { status: 'processing' } }),
      this.prisma.scheduledPayment.count({ where: { status: 'completed' } }),
      this.prisma.scheduledPayment.count({ where: { status: 'failed' } }),
    ]);

    return { pending, processing, completed, failed };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldPayments(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.scheduledPayment.deleteMany({
        where: {
          status: 'completed',
          executedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old payments`);
    } catch (error) {
      this.logger.error('Failed to cleanup old payments:', error);
    }
  }
}
