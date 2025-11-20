import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionWallet } from '../entities/subscription-wallet.entity';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    
    @InjectRepository(SubscriptionWallet)
    private walletRepo: Repository<SubscriptionWallet>,
    
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
  ) {}

  async getSubscriptionsByUser(userWallet: string) {
    return this.subscriptionRepo.find({
      where: { userWallet },
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionsByMerchant(merchantWallet: string) {
    return this.subscriptionRepo.find({
      where: { merchantWallet },
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionDetail(subscriptionPda: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionPda },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Get transaction history
    const transactions = await this.transactionRepo.find({
      where: { subscriptionPda },
      order: { blockTime: 'DESC' },
      take: 50,
    });

    return {
      ...subscription,
      transactions,
    };
  }

  async getWalletByOwner(ownerWallet: string) {
    return this.walletRepo.findOne({
      where: { ownerWallet },
    });
  }

  async getWalletBalance(walletPda: string) {
    // This would query Solana blockchain for real-time balance
    // For now, return from DB
    const wallet = await this.walletRepo.findOne({
      where: { walletPda },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getSubscriptionStats(userWallet: string) {
    const subscriptions = await this.subscriptionRepo.find({
      where: { userWallet },
    });

    const activeCount = subscriptions.filter(s => s.isActive).length;
    const totalSpent = subscriptions.reduce(
      (sum, s) => sum + BigInt(s.totalPaid),
      BigInt(0)
    );

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeCount,
      totalSpent: totalSpent.toString(),
      subscriptions,
    };
  }

  async getUpcomingPayments(userWallet: string) {
    const subscriptions = await this.subscriptionRepo.find({
      where: { userWallet, isActive: true },
    });

    return subscriptions.map(sub => {
      const lastPayment = parseInt(sub.lastPaymentTimestamp);
      const interval = parseInt(sub.paymentInterval);
      const nextPayment = lastPayment + interval;

      return {
        subscriptionPda: sub.subscriptionPda,
        merchantWallet: sub.merchantWallet,
        amount: sub.feeAmount,
        nextPaymentDate: new Date(nextPayment * 1000),
        daysUntil: Math.ceil((nextPayment * 1000 - Date.now()) / (1000 * 60 * 60 * 24)),
      };
    }).sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime());
  }
}