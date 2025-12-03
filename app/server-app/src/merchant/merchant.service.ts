import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { Prisma } from '../generated/client';

@Injectable()
export class MerchantService {
  constructor(private prisma: PrismaService) {}

  async registerMerchant(data: {
    walletAddress: string;
    companyName?: string;
    email?: string;
    logoUrl?: string;
  }) {
    const existing = await this.prisma.merchant.findUnique({
      where: { walletAddress: data.walletAddress },
    });

    if (existing) {
      return existing;
    }

    const webhookSecret = crypto.randomBytes(32).toString('hex');

    return this.prisma.merchant.create({
      data: {
        ...data,
        webhookSecret,
      },
    });
  }

  async updateMerchant(
    walletAddress: string,
    data: Prisma.MerchantUpdateInput,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { walletAddress },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return this.prisma.merchant.update({
      where: { walletAddress },
      data,
    });
  }

  async getMerchant(walletAddress: string) {
    return this.prisma.merchant.findUnique({
      where: { walletAddress },
      include: { plans: true },
    });
  }

  async getMerchantPlans(walletAddress: string) {
    return this.prisma.merchantPlan.findMany({
      where: { merchantWallet: walletAddress },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlanDetail(planPda: string) {
    return this.prisma.merchantPlan.findUnique({
      where: { planPda },
    });
  }

  async searchPlans(query: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) {
    const where: Prisma.MerchantPlanWhereInput = {
      isActive: true,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { planName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Note: Price filtering with BigInt stored as string requires runtime filtering
    let plans = await this.prisma.merchantPlan.findMany({
      where,
      orderBy: { totalSubscribers: 'desc' },
    });

    // Filter by price in-memory since we store as string
    if (query.minPrice !== undefined) {
      plans = plans.filter(
        (p) => BigInt(p.feeAmount) >= BigInt(query.minPrice!),
      );
    }

    if (query.maxPrice !== undefined) {
      plans = plans.filter(
        (p) => BigInt(p.feeAmount) <= BigInt(query.maxPrice!),
      );
    }

    return plans;
  }

  async getMerchantAnalytics(walletAddress: string) {
    const plans = await this.prisma.merchantPlan.findMany({
      where: { merchantWallet: walletAddress },
    });

    const subscriptions = await this.prisma.subscription.findMany({
      where: { merchantWallet: walletAddress },
    });

    const totalRevenue = plans.reduce(
      (sum, plan) => sum + BigInt(plan.totalRevenue),
      BigInt(0),
    );

    const activeSubscribers = subscriptions.filter((s) => s.isActive).length;

    const mrr = subscriptions
      .filter((s) => s.isActive)
      .reduce((sum, s) => {
        const interval = parseInt(s.paymentInterval);
        const amount = BigInt(s.feeAmount);
        const monthlyAmount = (amount * BigInt(2592000)) / BigInt(interval);
        return sum + monthlyAmount;
      }, BigInt(0));

    return {
      totalRevenue: totalRevenue.toString(),
      activeSubscribers,
      totalPlans: plans.length,
      monthlyRecurringRevenue: mrr.toString(),
      plans: plans.map((plan) => ({
        planId: plan.planId,
        planName: plan.planName,
        subscribers: plan.totalSubscribers,
        revenue: plan.totalRevenue,
      })),
    };
  }

  async getCustomers(merchantWallet: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { merchantWallet },
      orderBy: { createdAt: 'desc' },
    });

    const customerMap = new Map();

    for (const sub of subscriptions) {
      if (!customerMap.has(sub.userWallet)) {
        customerMap.set(sub.userWallet, {
          userWallet: sub.userWallet,
          subscriptions: [],
          totalSpent: BigInt(0),
          activeSubscriptions: 0,
        });
      }

      const customer = customerMap.get(sub.userWallet);
      customer.subscriptions.push(sub);
      customer.totalSpent += BigInt(sub.totalPaid);
      if (sub.isActive) customer.activeSubscriptions++;
    }

    return Array.from(customerMap.values()).map((c) => ({
      ...c,
      totalSpent: c.totalSpent.toString(),
    }));
  }

  async regenerateWebhookSecret(walletAddress: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { walletAddress },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const webhookSecret = crypto.randomBytes(32).toString('hex');

    await this.prisma.merchant.update({
      where: { walletAddress },
      data: { webhookSecret },
    });

    return { webhookSecret };
  }
}
