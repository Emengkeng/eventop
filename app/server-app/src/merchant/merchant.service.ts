import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../entities/merchant.entity';
import { MerchantPlan } from '../entities/merchant-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import * as crypto from 'crypto';

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Merchant)
    private merchantRepo: Repository<Merchant>,

    @InjectRepository(MerchantPlan)
    private planRepo: Repository<MerchantPlan>,

    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
  ) {}

  async registerMerchant(data: {
    walletAddress: string;
    companyName?: string;
    email?: string;
    logoUrl?: string;
  }) {
    const existing = await this.merchantRepo.findOne({
      where: { walletAddress: data.walletAddress },
    });

    if (existing) {
      return existing;
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const merchant = this.merchantRepo.create({
      ...data,
      webhookSecret,
    });

    return this.merchantRepo.save(merchant);
  }

  async updateMerchant(walletAddress: string, data: Partial<Merchant>) {
    const merchant = await this.merchantRepo.findOne({
      where: { walletAddress },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    Object.assign(merchant, data);
    return this.merchantRepo.save(merchant);
  }

  async getMerchant(walletAddress: string) {
    return this.merchantRepo.findOne({
      where: { walletAddress },
      relations: ['plans'],
    });
  }

  async getMerchantPlans(walletAddress: string) {
    return this.planRepo.find({
      where: { merchantWallet: walletAddress },
      order: { createdAt: 'DESC' },
    });
  }

  async getPlanDetail(planPda: string) {
    return this.planRepo.findOne({
      where: { planPda },
    });
  }

  async searchPlans(query: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) {
    const qb = this.planRepo.createQueryBuilder('plan');

    if (query.category) {
      qb.andWhere('plan.category = :category', { category: query.category });
    }

    if (query.minPrice) {
      qb.andWhere('CAST(plan.feeAmount AS BIGINT) >= :minPrice', {
        minPrice: query.minPrice,
      });
    }

    if (query.maxPrice) {
      qb.andWhere('CAST(plan.feeAmount AS BIGINT) <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(plan.planName ILIKE :search OR plan.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.andWhere('plan.isActive = true');
    qb.orderBy('plan.totalSubscribers', 'DESC');

    return qb.getMany();
  }

  async getMerchantAnalytics(walletAddress: string) {
    const plans = await this.planRepo.find({
      where: { merchantWallet: walletAddress },
    });

    const subscriptions = await this.subscriptionRepo.find({
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
        // Calculate monthly recurring revenue
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
    const subscriptions = await this.subscriptionRepo.find({
      where: { merchantWallet },
      order: { createdAt: 'DESC' },
    });

    // Group by user
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
    const merchant = await this.merchantRepo.findOne({
      where: { walletAddress },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    merchant.webhookSecret = crypto.randomBytes(32).toString('hex');
    await this.merchantRepo.save(merchant);

    return { webhookSecret: merchant.webhookSecret };
  }
}
