import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SolanaService } from './solana.service';
import { EventParserService } from './event-parser.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramEvent, TransactionRecordData, TransactionType } from '../types';

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private isIndexing = false;
  private lastProcessedSlot = 0;
  private readonly INDEXER_STATE_KEY = 'main_indexer';

  constructor(
    private prisma: PrismaService,
    private solanaService: SolanaService,
    private eventParser: EventParserService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing Indexer...');

    try {
      await this.solanaService.waitUntilReady();
      this.logger.log('✅ SolanaService is ready');

      const program = this.solanaService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }
      this.eventParser.setProgram(program);

      await this.loadLastProcessedSlot();
      await this.backfillMissedTransactions();
      await this.syncAllAccounts();
      this.startLogListener();

      this.logger.log('✅ Indexer initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize indexer:', error);
      throw error;
    }
  }

  private startLogListener(): void {
    const connection = this.solanaService.getConnection();
    const programId = this.solanaService.getProgramId();

    if (!connection || !programId) {
      this.logger.error(
        'Cannot start log listener: connection or programId is undefined',
      );
      return;
    }

    connection.onLogs(
      programId,
      (logs, ctx) => {
        void (async () => {
          this.logger.log(`📨 New logs detected at slot ${ctx.slot}`);

          try {
            const events = this.eventParser.parseTransactionLogs(logs.logs);

            for (const event of events) {
              await this.handleEvent(event, logs.signature, ctx.slot);
            }

            this.lastProcessedSlot = ctx.slot;
            await this.saveLastProcessedSlot();
          } catch (error) {
            this.logger.error('Error processing logs:', error);
          }
        })();
      },
      'confirmed',
    );

    this.logger.log('👂 Listening for program logs in real-time...');
  }

  private async backfillMissedTransactions(): Promise<void> {
    const connection = this.solanaService.getConnection();
    const programId = this.solanaService.getProgramId();

    try {
      const currentSlot = await connection.getSlot('confirmed');

      if (
        this.lastProcessedSlot === 0 ||
        this.lastProcessedSlot === currentSlot
      ) {
        this.logger.log(
          'No backfill needed - starting fresh or already up to date',
        );
        return;
      }

      const slotGap = currentSlot - this.lastProcessedSlot;
      this.logger.log(
        `🔄 Backfilling ${slotGap} slots (${this.lastProcessedSlot} -> ${currentSlot})`,
      );

      const signatures = await connection.getSignaturesForAddress(
        programId,
        { limit: 1000 },
        'confirmed',
      );

      let backfilledCount = 0;

      for (const sig of signatures) {
        if (sig.slot && sig.slot <= this.lastProcessedSlot) {
          break;
        }

        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (tx?.meta?.logMessages) {
            const events = this.eventParser.parseTransactionLogs(
              tx.meta.logMessages,
            );

            for (const event of events) {
              await this.handleEvent(event, sig.signature, sig.slot || 0);
            }

            backfilledCount++;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to process transaction ${sig.signature}:`,
            error,
          );
        }
      }

      this.logger.log(`✅ Backfilled ${backfilledCount} transactions`);
    } catch (error) {
      this.logger.error('Error during backfill:', error);
    }
  }

  private async handleEvent(
    event: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    this.logger.log(`Processing event: ${event.name}`);

    switch (event.name) {
      case 'SubscriptionWalletCreated':
        await this.handleSubscriptionWalletCreated(event);
        break;
      case 'YieldEnabled':
        await this.handleYieldEnabled(event);
        break;
      case 'WalletDeposit':
        await this.handleWalletDeposit(event, signature, slot);
        break;
      case 'WalletWithdrawal':
        await this.handleWalletWithdrawal(event, signature, slot);
        break;
      case 'SubscriptionCreated':
        await this.handleSubscriptionCreated(event, signature, slot);
        break;
      case 'PaymentExecuted':
        await this.handlePaymentExecuted(event, signature, slot);
        break;
      case 'SubscriptionCancelled':
        await this.handleSubscriptionCancelled(event, signature, slot);
        break;
      case 'YieldClaimed':
        await this.handleYieldClaimed(event, signature, slot);
        break;
      default:
        this.logger.warn(`Unhandled event type`);
    }
  }

  private async handleSubscriptionWalletCreated(
    data: ProgramEvent,
  ): Promise<void> {
    if (data.name !== 'SubscriptionWalletCreated') return;

    await this.prisma.subscriptionWallet.create({
      data: {
        walletPda: data.data.walletPda.toString(),
        ownerWallet: data.data.owner.toString(),
        mint: data.data.mint.toString(),
        isYieldEnabled: false,
        totalSubscriptions: 0,
        totalSpent: '0',
      },
    });

    this.logger.log(
      `✅ Subscription wallet created: ${data.data.walletPda.toString()}`,
    );
  }

  private async handleYieldEnabled(data: ProgramEvent): Promise<void> {
    if (data.name !== 'YieldEnabled') return;

    await this.prisma.subscriptionWallet.update({
      where: { walletPda: data.data.walletPda.toString() },
      data: {
        isYieldEnabled: true,
        yieldStrategy: data.data.strategy,
        yieldVault: data.data.vault.toString(),
      },
    });

    this.logger.log(
      `✅ Yield enabled for wallet: ${data.data.walletPda.toString()}`,
    );
  }

  private async handleWalletDeposit(
    data: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    if (data.name !== 'WalletDeposit') return;

    await this.recordTransaction({
      signature,
      subscriptionPda: '',
      type: TransactionType.Deposit,
      amount: data.data.amount.toString(),
      fromWallet: data.data.user.toString(),
      toWallet: data.data.walletPda.toString(),
      slot,
    });

    this.logger.log(
      `✅ Wallet deposit: ${data.data.amount.toString()} to ${data.data.walletPda.toString()}`,
    );
  }

  private async handleWalletWithdrawal(
    data: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    if (data.name !== 'WalletWithdrawal') return;

    await this.recordTransaction({
      signature,
      subscriptionPda: '',
      type: TransactionType.Withdrawal,
      amount: data.data.amount.toString(),
      fromWallet: data.data.walletPda.toString(),
      toWallet: data.data.user.toString(),
      slot,
    });

    this.logger.log(
      `✅ Wallet withdrawal: ${data.data.amount.toString()} from ${data.data.walletPda.toString()}`,
    );
  }

  private async handleSubscriptionCreated(
    data: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    if (data.name !== 'SubscriptionCreated') return;

    const merchantPlan = await this.prisma.merchantPlan.findUnique({
      where: { planPda: data.data.planId },
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        subscriptionPda: data.data.subscriptionPda.toString(),
        userWallet: data.data.user.toString(),
        subscriptionWalletPda: data.data.wallet.toString(),
        merchantWallet: data.data.merchant.toString(),
        merchantPlanPda: data.data.planId,
        mint: merchantPlan?.mint || 'USDC',
        feeAmount: merchantPlan?.feeAmount || '0',
        paymentInterval: merchantPlan?.paymentInterval || '0',
        lastPaymentTimestamp: Date.now().toString(),
        totalPaid: '0',
        paymentCount: 0,
        isActive: true,
      },
    });

    if (merchantPlan) {
      await this.prisma.merchantPlan.update({
        where: { planPda: merchantPlan.planPda },
        data: { totalSubscribers: { increment: 1 } },
      });
    }

    await this.prisma.subscriptionWallet.update({
      where: { walletPda: data.data.wallet.toString() },
      data: { totalSubscriptions: { increment: 1 } },
    });

    await this.recordTransaction({
      signature,
      subscriptionPda: subscription.subscriptionPda,
      type: TransactionType.SubscriptionCreated,
      amount: '0',
      fromWallet: subscription.userWallet,
      toWallet: subscription.merchantWallet,
      slot,
    });

    this.logger.log(`✅ Subscription created: ${subscription.subscriptionPda}`);
  }

  private async handlePaymentExecuted(
    data: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    if (data.name !== 'PaymentExecuted') return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { subscriptionPda: data.data.subscriptionPda.toString() },
    });

    if (subscription) {
      const amount = data.data.amount.toString();
      const newTotalPaid = (
        BigInt(subscription.totalPaid) + BigInt(amount)
      ).toString();

      await this.prisma.subscription.update({
        where: { subscriptionPda: subscription.subscriptionPda },
        data: {
          totalPaid: newTotalPaid,
          paymentCount: data.data.paymentNumber,
          lastPaymentTimestamp: Date.now().toString(),
        },
      });

      // merchantPlan.totalRevenue is stored as a string in the database;
      // read current value, add the amount using BigInt, and write back the summed string.
      const merchantPlanRecord = await this.prisma.merchantPlan.findUnique({
        where: { planPda: subscription.merchantPlanPda },
      });

      if (merchantPlanRecord) {
        const currentRevenue = merchantPlanRecord.totalRevenue ?? '0';
        const updatedTotalRevenue = (
          BigInt(currentRevenue) + BigInt(amount)
        ).toString();

        await this.prisma.merchantPlan.update({
          where: { planPda: merchantPlanRecord.planPda },
          data: {
            totalRevenue: updatedTotalRevenue,
          },
        });
      }

      // subscriptionWallet.totalSpent is stored as a string in the database;
      // read current value, add the amount using BigInt, and write back the summed string.
      const subscriptionWalletRecord =
        await this.prisma.subscriptionWallet.findUnique({
          where: { walletPda: subscription.subscriptionWalletPda },
        });

      if (subscriptionWalletRecord) {
        const currentTotalSpent = subscriptionWalletRecord.totalSpent ?? '0';
        const updatedTotalSpent = (
          BigInt(currentTotalSpent) + BigInt(amount)
        ).toString();

        await this.prisma.subscriptionWallet.update({
          where: { walletPda: subscriptionWalletRecord.walletPda },
          data: {
            totalSpent: updatedTotalSpent,
          },
        });
      }

      await this.recordTransaction({
        signature,
        subscriptionPda: subscription.subscriptionPda,
        type: TransactionType.Payment,
        amount,
        fromWallet: subscription.userWallet,
        toWallet: subscription.merchantWallet,
        slot,
      });

      this.logger.log(
        `✅ Payment #${data.data.paymentNumber} executed: ${amount} for ${subscription.subscriptionPda}`,
      );
    }
  }

  private async handleSubscriptionCancelled(
    data: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    if (data.name !== 'SubscriptionCancelled') return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { subscriptionPda: data.data.subscriptionPda.toString() },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { subscriptionPda: subscription.subscriptionPda },
        data: {
          isActive: false,
          cancelledAt: new Date(),
        },
      });

      await this.prisma.merchantPlan.update({
        where: { planPda: subscription.merchantPlanPda },
        data: { totalSubscribers: { decrement: 1 } },
      });

      await this.prisma.subscriptionWallet.update({
        where: { walletPda: subscription.subscriptionWalletPda },
        data: { totalSubscriptions: { decrement: 1 } },
      });

      await this.recordTransaction({
        signature,
        subscriptionPda: subscription.subscriptionPda,
        type: TransactionType.Cancel,
        amount: '0',
        fromWallet: subscription.merchantWallet,
        toWallet: subscription.userWallet,
        slot,
      });

      this.logger.log(
        `✅ Subscription cancelled: ${subscription.subscriptionPda}`,
      );
    }
  }

  private async handleYieldClaimed(
    data: ProgramEvent,
    signature: string,
    slot: number,
  ): Promise<void> {
    if (data.name !== 'YieldClaimed') return;

    this.logger.log(
      `✅ Yield claimed: ${data.data.amount.toString()} from wallet ${data.data.walletPda.toString()}`,
    );

    await this.recordTransaction({
      signature,
      subscriptionPda: '',
      type: TransactionType.Withdrawal,
      amount: data.data.amount.toString(),
      fromWallet: data.data.walletPda.toString(),
      toWallet: data.data.user.toString(),
      slot,
    });
  }

  private async recordTransaction(data: TransactionRecordData): Promise<void> {
    await this.prisma.transaction.create({
      data: {
        ...data,
        blockTime: Date.now().toString(),
        status: 'success',
      },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncAllAccounts(): Promise<void> {
    if (this.isIndexing) {
      this.logger.warn('Sync already in progress, skipping...');
      return;
    }

    this.isIndexing = true;
    this.logger.log('🔄 Starting account sync...');

    try {
      await this.syncMerchantPlans();
      await this.syncSubscriptionWallets();
      await this.syncSubscriptions();
      await this.updateLastSyncTime();

      this.logger.log('✅ Account sync completed');
    } catch (error) {
      this.logger.error('Error during sync:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  private async syncMerchantPlans(): Promise<void> {
    this.logger.log('Syncing merchant plans...');

    const plans = await this.solanaService.getAllMerchantPlans();

    for (const { pubkey, account } of plans) {
      // First, ensure the merchant exists
      await this.prisma.merchant.upsert({
        where: { walletAddress: account.merchant.toString() },
        create: {
          walletAddress: account.merchant.toString(),
        },
        update: {}, // No updates needed if it already exists
      });

      // Now upsert the merchant plan
      await this.prisma.merchantPlan.upsert({
        where: { planPda: pubkey.toString() },
        create: {
          planPda: pubkey.toString(),
          merchantWallet: account.merchant.toString(),
          planId: account.planId,
          planName: account.planName,
          mint: account.mint.toString(),
          feeAmount: account.feeAmount.toString(),
          paymentInterval: account.paymentInterval.toString(),
          isActive: account.isActive,
          totalSubscribers: account.totalSubscribers,
          totalRevenue: '0',
        },
        update: {
          merchantWallet: account.merchant.toString(),
          planId: account.planId,
          planName: account.planName,
          mint: account.mint.toString(),
          feeAmount: account.feeAmount.toString(),
          paymentInterval: account.paymentInterval.toString(),
          isActive: account.isActive,
          totalSubscribers: account.totalSubscribers,
        },
      });
    }

    this.logger.log(`✅ Synced ${plans.length} merchant plans`);
  }

  private async syncSubscriptionWallets(): Promise<void> {
    this.logger.log('Syncing subscription wallets...');

    const wallets = await this.solanaService.getAllSubscriptionWallets();

    for (const { pubkey, account } of wallets) {
      await this.prisma.subscriptionWallet.upsert({
        where: { walletPda: pubkey.toString() },
        create: {
          walletPda: pubkey.toString(),
          ownerWallet: account.owner.toString(),
          mint: account.mint.toString(),
          isYieldEnabled: account.isYieldEnabled,
          yieldStrategy: account.yieldStrategy,
          yieldVault: account.yieldVault.toString(),
          totalSubscriptions: account.totalSubscriptions,
          totalSpent: account.totalSpent.toString(),
        },
        update: {
          ownerWallet: account.owner.toString(),
          mint: account.mint.toString(),
          isYieldEnabled: account.isYieldEnabled,
          yieldStrategy: account.yieldStrategy,
          yieldVault: account.yieldVault.toString(),
          totalSubscriptions: account.totalSubscriptions,
          totalSpent: account.totalSpent.toString(),
        },
      });
    }

    this.logger.log(`✅ Synced ${wallets.length} subscription wallets`);
  }

  private async syncSubscriptions(): Promise<void> {
    this.logger.log('Syncing subscriptions...');

    const subscriptions = await this.solanaService.getAllSubscriptions();

    for (const { pubkey, account } of subscriptions) {
      await this.prisma.subscription.upsert({
        where: { subscriptionPda: pubkey.toString() },
        create: {
          subscriptionPda: pubkey.toString(),
          userWallet: account.user.toString(),
          subscriptionWalletPda: account.subscriptionWallet.toString(),
          merchantWallet: account.merchant.toString(),
          merchantPlanPda: account.merchantPlan.toString(),
          mint: account.mint.toString(),
          feeAmount: account.feeAmount.toString(),
          paymentInterval: account.paymentInterval.toString(),
          lastPaymentTimestamp: account.lastPaymentTimestamp.toString(),
          totalPaid: account.totalPaid.toString(),
          paymentCount: account.paymentCount,
          isActive: account.isActive,
        },
        update: {
          userWallet: account.user.toString(),
          subscriptionWalletPda: account.subscriptionWallet.toString(),
          merchantWallet: account.merchant.toString(),
          merchantPlanPda: account.merchantPlan.toString(),
          mint: account.mint.toString(),
          feeAmount: account.feeAmount.toString(),
          paymentInterval: account.paymentInterval.toString(),
          lastPaymentTimestamp: account.lastPaymentTimestamp.toString(),
          totalPaid: account.totalPaid.toString(),
          paymentCount: account.paymentCount,
          isActive: account.isActive,
        },
      });
    }

    this.logger.log(`✅ Synced ${subscriptions.length} subscriptions`);
  }

  private async loadLastProcessedSlot(): Promise<void> {
    const connection = this.solanaService.getConnection();

    if (!connection) {
      throw new Error('Connection is not initialized');
    }

    const state = await this.prisma.indexerState.findUnique({
      where: { key: this.INDEXER_STATE_KEY },
    });

    if (state) {
      this.lastProcessedSlot = Number(state.lastProcessedSlot);
      this.logger.log(
        `📍 Loaded last processed slot from DB: ${this.lastProcessedSlot}`,
      );
    } else {
      this.lastProcessedSlot = await connection.getSlot('confirmed');
      this.logger.log(
        `📍 First run - starting from current slot: ${this.lastProcessedSlot}`,
      );
      await this.saveLastProcessedSlot();
    }
  }

  private async saveLastProcessedSlot(): Promise<void> {
    await this.prisma.indexerState.upsert({
      where: { key: this.INDEXER_STATE_KEY },
      create: {
        key: this.INDEXER_STATE_KEY,
        lastProcessedSlot: BigInt(this.lastProcessedSlot),
        lastSyncTime: new Date(),
      },
      update: {
        lastProcessedSlot: BigInt(this.lastProcessedSlot),
        lastSyncTime: new Date(),
      },
    });
  }

  private async updateLastSyncTime(): Promise<void> {
    await this.prisma.indexerState.update({
      where: { key: this.INDEXER_STATE_KEY },
      data: { lastSyncTime: new Date() },
    });
  }
}
