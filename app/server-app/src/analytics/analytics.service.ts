import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { Transaction } from '../entities/transaction.entity';
import { MerchantPlan } from '../entities/merchant-plan.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    
    @InjectRepository(MerchantPlan)
    private planRepo: Repository<MerchantPlan>,
  ) {}

  async getRevenueChart(merchantWallet: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepo.find({
      where: {
        toWallet: merchantWallet,
        type: 'payment',
        indexedAt: Between(startDate, new Date()),
      },
      order: { blockTime: 'ASC' },
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

    const subscriptions = await this.subscriptionRepo.find({
      where: {
        merchantWallet,
        createdAt: Between(startDate, new Date()),
      },
      order: { createdAt: 'ASC' },
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
    const subscriptions = await this.subscriptionRepo.find({
      where: { merchantWallet },
    });

    const total = subscriptions.length;
    const cancelled = subscriptions.filter(s => !s.isActive).length;

    return {
      totalSubscriptions: total,
      cancelledSubscriptions: cancelled,
      churnRate: total > 0 ? (cancelled / total) * 100 : 0,
    };
  }

  async getPlanPerformance(merchantWallet: string) {
    const plans = await this.planRepo.find({
      where: { merchantWallet },
    });

    return plans.map(plan => ({
      planId: plan.planId,
      planName: plan.planName,
      subscribers: plan.totalSubscribers,
      revenue: plan.totalRevenue,
      avgRevenuePerSubscriber: 
        plan.totalSubscribers > 0
          ? (BigInt(plan.totalRevenue) / BigInt(plan.totalSubscribers)).toString()
          : '0',
    })).sort((a, b) => b.subscribers - a.subscribers);
  }
}