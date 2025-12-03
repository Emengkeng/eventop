import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

export interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  async sendWebhook(merchantWallet: string, payload: WebhookPayload) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { walletAddress: merchantWallet },
    });

    if (!merchant || !merchant.webhookUrl) {
      this.logger.warn(
        `No webhook URL configured for merchant: ${merchantWallet}`,
      );
      return;
    }

    try {
      const signature = this.generateSignature(
        payload,
        merchant.webhookSecret!,
      );

      await firstValueFrom(
        this.httpService.post(merchant.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': payload.timestamp.toString(),
          },
          timeout: 10000,
        }),
      );

      this.logger.log(
        `✅ Webhook sent to ${merchant.companyName || merchantWallet}: ${payload.event}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Webhook failed for ${merchantWallet}: ${errorMessage}`,
      );
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  async notifySubscriptionCreated(data: {
    subscriptionPda: string;
    userWallet: string;
    merchantWallet: string;
    planId: string;
    amountPrepaid: string;
  }) {
    await this.sendWebhook(data.merchantWallet, {
      event: 'subscription.created',
      timestamp: Date.now(),
      data: {
        subscription_id: data.subscriptionPda,
        user_wallet: data.userWallet,
        plan_id: data.planId,
        amount_prepaid: data.amountPrepaid,
      },
    });
  }

  async notifyPaymentExecuted(data: {
    subscriptionPda: string;
    userWallet: string;
    merchantWallet: string;
    amount: string;
    paymentNumber: number;
  }) {
    await this.sendWebhook(data.merchantWallet, {
      event: 'subscription.payment_succeeded',
      timestamp: Date.now(),
      data: {
        subscription_id: data.subscriptionPda,
        user_wallet: data.userWallet,
        amount: data.amount,
        payment_number: data.paymentNumber,
      },
    });
  }

  async notifySubscriptionCancelled(data: {
    subscriptionPda: string;
    userWallet: string;
    merchantWallet: string;
    refundAmount: string;
    paymentsMade: number;
  }) {
    await this.sendWebhook(data.merchantWallet, {
      event: 'subscription.cancelled',
      timestamp: Date.now(),
      data: {
        subscription_id: data.subscriptionPda,
        user_wallet: data.userWallet,
        refund_amount: data.refundAmount,
        payments_made: data.paymentsMade,
      },
    });
  }

  async notifyPaymentFailed(data: {
    subscriptionPda: string;
    userWallet: string;
    merchantWallet: string;
    amountRequired: string;
    balanceAvailable: string;
    failureCount: number;
  }) {
    await this.sendWebhook(data.merchantWallet, {
      event: 'subscription.payment_failed',
      timestamp: Date.now(),
      data: {
        subscription_id: data.subscriptionPda,
        user_wallet: data.userWallet,
        amount_required: data.amountRequired,
        balance_available: data.balanceAvailable,
        failure_count: data.failureCount,
      },
    });
  }
}
