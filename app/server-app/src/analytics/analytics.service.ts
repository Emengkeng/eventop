import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getRevenueChart(merchantWallet: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        toWallet: merchantWallet,
        type: 'payment',
        indexedAt: {
          gte: startDate,
          lte: new Date(),
        },
      },
      orderBy: { blockTime: 'asc' },
    });

    // Group by day
    const revenueByDay = new Map<string, bigint>();

    for (const tx of transactions) {
      const date = new Date(parseInt(tx.blockTime) * 1000);
      const dateKey = date.toISOString().split('T')[0];

      const current = revenueByDay.get(dateKey) || BigInt(0);
      revenueByDay.set(dateKey, current + BigInt(tx.amount));
    }

    return Array.from(revenueByDay.entries()).map(([date, amount]) => ({
      date,
      revenue: amount.toString(),
    }));
  }

  async getSubscriberGrowth(merchantWallet: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        merchantWallet,
        createdAt: {
          gte: startDate,
          lte: new Date(),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const subscribersByDay = new Map<string, number>();
    let cumulative = 0;

    for (const sub of subscriptions) {
      const dateKey = sub.createdAt.toISOString().split('T')[0];
      cumulative++;
      subscribersByDay.set(dateKey, cumulative);
    }

    return Array.from(subscribersByDay.entries()).map(([date, count]) => ({
      date,
      subscribers: count,
    }));
  }

  async getChurnRate(merchantWallet: string) {
    const total = await this.prisma.subscription.count({
      where: { merchantWallet },
    });

    const cancelled = await this.prisma.subscription.count({
      where: {
        merchantWallet,
        isActive: false,
      },
    });

    return {
      totalSubscriptions: total,
      cancelledSubscriptions: cancelled,
      churnRate: total > 0 ? (cancelled / total) * 100 : 0,
    };
  }

  async getPlanPerformance(merchantWallet: string) {
    const plans = await this.prisma.merchantPlan.findMany({
      where: { merchantWallet },
    });

    return plans
      .map((plan) => ({
        planId: plan.planId,
        planName: plan.planName,
        subscribers: plan.totalSubscribers,
        revenue: plan.totalRevenue,
        avgRevenuePerSubscriber:
          plan.totalSubscribers > 0
            ? (
                BigInt(plan.totalRevenue) / BigInt(plan.totalSubscribers)
              ).toString()
            : '0',
      }))
      .sort((a, b) => b.subscribers - a.subscribers);
  }
}
