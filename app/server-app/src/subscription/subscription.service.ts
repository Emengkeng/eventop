import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getSubscriptionsByUser(userWallet: string) {
    return this.prisma.subscription.findMany({
      where: { userWallet },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubscriptionsByMerchant(merchantWallet: string) {
    return this.prisma.subscription.findMany({
      where: { merchantWallet },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubscriptionDetail(subscriptionPda: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { subscriptionPda },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { subscriptionPda },
      orderBy: { blockTime: 'desc' },
      take: 50,
    });

    return {
      ...subscription,
      transactions,
    };
  }

  async getWalletByOwner(ownerWallet: string) {
    return this.prisma.subscriptionWallet.findFirst({
      where: { ownerWallet },
    });
  }

  async getWalletBalance(walletPda: string) {
    const wallet = await this.prisma.subscriptionWallet.findUnique({
      where: { walletPda },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getSubscriptionStats(userWallet: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userWallet },
    });

    const activeCount = subscriptions.filter((s) => s.isActive).length;
    const totalSpent = subscriptions.reduce(
      (sum, s) => sum + BigInt(s.totalPaid),
      BigInt(0),
    );

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeCount,
      totalSpent: totalSpent.toString(),
      subscriptions,
    };
  }

  async getUpcomingPayments(userWallet: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userWallet, isActive: true },
    });

    return subscriptions
      .map((sub) => {
        const lastPayment = parseInt(sub.lastPaymentTimestamp);
        const interval = parseInt(sub.paymentInterval);
        const nextPayment = lastPayment + interval;

        return {
          subscriptionPda: sub.subscriptionPda,
          merchantWallet: sub.merchantWallet,
          amount: sub.feeAmount,
          nextPaymentDate: new Date(nextPayment * 1000),
          daysUntil: Math.ceil(
            (nextPayment * 1000 - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        };
      })
      .sort(
        (a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime(),
      );
  }
}
