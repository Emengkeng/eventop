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

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private isIndexing = false;
  private lastProcessedSlot = 0;

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

    // Initialize event parser with program
    const program = this.solanaService.getProgram();
    if (program) {
      this.eventParser.setProgram(program);
    }

    // Load last processed slot from DB
    await this.loadLastProcessedSlot();

    // Start listening to program logs
    this.startLogListener();

    // Initial sync
    await this.syncAllAccounts();

    this.logger.log('✅ Indexer initialized');
  }

  /**
   * Real-time log listener for new transactions
   */
  private startLogListener(): void {
    const connection = this.solanaService.getConnection();
    const programId = this.solanaService.getProgramId();

    connection.onLogs(
      programId,
      (logs, ctx) => {
        void (async () => {
          this.logger.log(`📝 New logs detected at slot ${ctx.slot}`);

          try {
            // Parse events from logs using typed parser
            const events = this.eventParser.parseTransactionLogs(logs.logs);

            // Process each event with proper typing
            for (const event of events) {
              await this.handleEvent(event, logs.signature, ctx.slot);
            }

            // Update last processed slot
            this.lastProcessedSlot = ctx.slot;
          } catch (error) {
            this.logger.error('Error processing logs:', error);
          }
        })();
      },
      'confirmed',
    );

    this.logger.log('👂 Listening for program logs...');
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
        // TypeScript will ensure this is exhaustive
        // const _exhaustive: never = event;
        this.logger.warn(`Unhandled event type`);
    }
  }

  /**
   * Event Handlers (now with proper typing)
   */

  private async handleSubscriptionWalletCreated(
    data: ProgramEvent,
    // signature: string,
    // slot: number,
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
    // Record the deposit transaction
    await this.recordTransaction({
      signature,
      subscriptionPda: '', // No subscription involved
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
    // Fetch the merchant plan to get fee details
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

    // Update merchant plan subscriber count
    if (merchantPlan) {
      await this.merchantPlanRepo.increment(
        { planPda: merchantPlan.planPda },
        'totalSubscribers',
        1,
      );
    }

    // Update wallet subscription count
    await this.walletRepo.increment(
      { walletPda: data.data.wallet.toString() },
      'totalSubscriptions',
      1,
    );

    // Record transaction
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

      // Update subscription
      subscription.totalPaid = (
        BigInt(subscription.totalPaid) + BigInt(amount)
      ).toString();
      subscription.paymentCount = data.data.paymentNumber;
      subscription.lastPaymentTimestamp = Date.now().toString();

      await this.subscriptionRepo.save(subscription);

      // Update merchant plan revenue
      await this.merchantPlanRepo.increment(
        { planPda: subscription.merchantPlanPda },
        'totalRevenue',
        parseInt(amount),
      );

      // Update wallet total spent
      await this.walletRepo.increment(
        { walletPda: subscription.subscriptionWalletPda },
        'totalSpent',
        parseInt(amount),
      );

      // Record transaction
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

      // Decrement counts
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

      // Record transaction
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

    // You can optionally record this as a transaction
    await this.recordTransaction({
      signature,
      subscriptionPda: '',
      type: TransactionType.Withdrawal, // Yield claim is a form of withdrawal
      amount: data.data.amount.toString(),
      fromWallet: data.data.walletPda.toString(),
      toWallet: data.data.user.toString(),
      slot,
    });
  }

  /**
   * Record transaction in database
   */
  private async recordTransaction(data: TransactionRecordData): Promise<void> {
    const transaction = this.transactionRepo.create({
      ...data,
      blockTime: Date.now().toString(),
      status: 'success',
    });

    await this.transactionRepo.save(transaction);
  }

  /**
   * Sync all existing accounts (run on startup or manually)
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
      // Sync merchant plans
      await this.syncMerchantPlans();

      // Sync subscription wallets
      await this.syncSubscriptionWallets();

      // Sync subscriptions
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
          totalRevenue: '0', // This would need to be calculated
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

  private async loadLastProcessedSlot(): Promise<void> {
    // Load from DB or start from current slot
    const connection = this.solanaService.getConnection();
    this.lastProcessedSlot = await connection.getSlot('confirmed');
    this.logger.log(`Starting from slot: ${this.lastProcessedSlot}`);
  }
}
