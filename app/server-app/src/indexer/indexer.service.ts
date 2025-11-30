import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SolanaService } from './solana.service';
import { EventParserService } from './event-parser.service';

import { MerchantPlan } from '../entities/merchant-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionWallet } from '../entities/subscription-wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { ProgramEvent, TransactionRecordData, TransactionType } from '../types';

// // Add a new entity to track indexer state
// interface IndexerState {
//   lastProcessedSlot: number;
//   lastSyncTime: Date;
// }

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private isIndexing = false;
  private lastProcessedSlot = 0;
  private indexerStateKey = 'indexer_state';

  constructor(
    @InjectRepository(MerchantPlan)
    private merchantPlanRepo: Repository<MerchantPlan>,

    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,

    @InjectRepository(SubscriptionWallet)
    private walletRepo: Repository<SubscriptionWallet>,

    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,

    private solanaService: SolanaService,
    private eventParser: EventParserService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing Indexer...');

    try {
      // Wait for SolanaService to be fully ready
      await this.solanaService.waitUntilReady();
      this.logger.log('✅ SolanaService is ready');

      // Initialize event parser with program
      const program = this.solanaService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }
      this.eventParser.setProgram(program);

      // Load last processed slot from DB or get current slot
      await this.loadLastProcessedSlot();

      // Backfill any missed transactions since last run
      await this.backfillMissedTransactions();

      // Initial full account sync
      await this.syncAllAccounts();

      // Start listening to program logs for real-time updates
      this.startLogListener();

      this.logger.log('✅ Indexer initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize indexer:', error);
      throw error;
    }
  }

  /**
   * Real-time log listener for new transactions
   * This captures events as they happen on-chain
   */
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

            // Update last processed slot
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

  /**
   * NEW: Backfill transactions that occurred while server was down
   */
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

      // Get transaction signatures for the program since last processed slot
      const signatures = await connection.getSignaturesForAddress(
        programId,
        {
          limit: 1000, // Adjust based on your needs
        },
        'confirmed',
      );

      let backfilledCount = 0;

      for (const sig of signatures) {
        // Only process transactions after our last processed slot
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

  /**
   * Handle individual events with type discrimination
   */
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

  // ... rest of your event handlers remain the same ...

  private async handleSubscriptionWalletCreated(
    data: ProgramEvent,
  ): Promise<void> {
    if (data.name !== 'SubscriptionWalletCreated') return;

    const wallet = this.walletRepo.create({
      walletPda: data.data.walletPda.toString(),
      ownerWallet: data.data.owner.toString(),
      mint: data.data.mint.toString(),
      isYieldEnabled: false,
      totalSubscriptions: 0,
      totalSpent: '0',
    });

    await this.walletRepo.save(wallet);
    this.logger.log(`✅ Subscription wallet created: ${wallet.walletPda}`);
  }

  private async handleYieldEnabled(data: ProgramEvent): Promise<void> {
    if (data.name !== 'YieldEnabled') return;
    await this.walletRepo.update(
      { walletPda: data.data.walletPda.toString() },
      {
        isYieldEnabled: true,
        yieldStrategy: data.data.strategy,
        yieldVault: data.data.vault.toString(),
      },
    );

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

    const merchantPlan = await this.merchantPlanRepo.findOne({
      where: { merchantWallet: data.data.merchant.toString() },
    });

    const subscription = this.subscriptionRepo.create({
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
    });

    await this.subscriptionRepo.save(subscription);

    if (merchantPlan) {
      await this.merchantPlanRepo.increment(
        { planPda: merchantPlan.planPda },
        'totalSubscribers',
        1,
      );
    }

    await this.walletRepo.increment(
      { walletPda: data.data.wallet.toString() },
      'totalSubscriptions',
      1,
    );

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
    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionPda: data.data.subscriptionPda.toString() },
    });

    if (subscription) {
      const amount = data.data.amount.toString();

      subscription.totalPaid = (
        BigInt(subscription.totalPaid) + BigInt(amount)
      ).toString();
      subscription.paymentCount = data.data.paymentNumber;
      subscription.lastPaymentTimestamp = Date.now().toString();

      await this.subscriptionRepo.save(subscription);

      await this.merchantPlanRepo.increment(
        { planPda: subscription.merchantPlanPda },
        'totalRevenue',
        parseInt(amount),
      );

      await this.walletRepo.increment(
        { walletPda: subscription.subscriptionWalletPda },
        'totalSpent',
        parseInt(amount),
      );

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
    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionPda: data.data.subscriptionPda.toString() },
    });

    if (subscription) {
      subscription.isActive = false;
      subscription.cancelledAt = new Date();

      await this.subscriptionRepo.save(subscription);

      await this.merchantPlanRepo.decrement(
        { planPda: subscription.merchantPlanPda },
        'totalSubscribers',
        1,
      );

      await this.walletRepo.decrement(
        { walletPda: subscription.subscriptionWalletPda },
        'totalSubscriptions',
        1,
      );

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
    const transaction = this.transactionRepo.create({
      ...data,
      blockTime: Date.now().toString(),
      status: 'success',
    });

    await this.transactionRepo.save(transaction);
  }

  /**
   * Sync all existing accounts (runs hourly + on startup)
   */
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
      await this.merchantPlanRepo.upsert(
        {
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
        ['planPda'],
      );
    }

    this.logger.log(`✅ Synced ${plans.length} merchant plans`);
  }

  private async syncSubscriptionWallets(): Promise<void> {
    this.logger.log('Syncing subscription wallets...');

    const wallets = await this.solanaService.getAllSubscriptionWallets();

    for (const { pubkey, account } of wallets) {
      await this.walletRepo.upsert(
        {
          walletPda: pubkey.toString(),
          ownerWallet: account.owner.toString(),
          mint: account.mint.toString(),
          isYieldEnabled: account.isYieldEnabled,
          yieldStrategy: account.yieldStrategy,
          yieldVault: account.yieldVault.toString(),
          totalSubscriptions: account.totalSubscriptions,
          totalSpent: account.totalSpent.toString(),
        },
        ['walletPda'],
      );
    }

    this.logger.log(`✅ Synced ${wallets.length} subscription wallets`);
  }

  private async syncSubscriptions(): Promise<void> {
    this.logger.log('Syncing subscriptions...');

    const subscriptions = await this.solanaService.getAllSubscriptions();

    for (const { pubkey, account } of subscriptions) {
      await this.subscriptionRepo.upsert(
        {
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
        ['subscriptionPda'],
      );
    }

    this.logger.log(`✅ Synced ${subscriptions.length} subscriptions`);
  }

  /**
   * Load last processed slot from database or use current slot
   */
  private async loadLastProcessedSlot(): Promise<void> {
    const connection = this.solanaService.getConnection();

    if (!connection) {
      throw new Error('Connection is not initialized');
    }

    // Try to load from database (you'd need to store this)
    // For now, we'll just get the current slot
    this.lastProcessedSlot = await connection.getSlot('confirmed');
    this.logger.log(`Starting from slot: ${this.lastProcessedSlot}`);
  }

  /**
   * Save last processed slot (you'd want to persist this to DB)
   */
  private async saveLastProcessedSlot(): Promise<void> {
    // TODO: Save to database
    // Example: await this.configRepo.upsert({ key: 'last_slot', value: this.lastProcessedSlot })
  }
}
