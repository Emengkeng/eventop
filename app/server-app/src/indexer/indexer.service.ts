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
  private startLogListener() {
    const connection = this.solanaService.getConnection();
    const programId = this.solanaService.getProgramId();

    connection.onLogs(
      programId,
      (logs, ctx) => {
        void (async () => {
          this.logger.log(`📝 New logs detected at slot ${ctx.slot}`);

          try {
            // Parse events from logs
            const events = this.eventParser.parseTransactionLogs(logs.logs);

            // Process each event
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
   * Handle individual events
   */
  private async handleEvent(event: any, signature: string, slot: number) {
    this.logger.log(`Processing event: ${event.name}`);

    switch (event.name) {
      case 'MerchantPlanCreated':
        await this.handleMerchantPlanCreated(event.data, signature, slot);
        break;

      case 'SubscriptionWalletCreated':
        await this.handleSubscriptionWalletCreated(event.data, signature, slot);
        break;

      case 'SubscriptionCreated':
        await this.handleSubscriptionCreated(event.data, signature, slot);
        break;

      case 'PaymentExecuted':
        await this.handlePaymentExecuted(event.data, signature, slot);
        break;

      case 'SubscriptionCancelled':
        await this.handleSubscriptionCancelled(event.data, signature, slot);
        break;

      case 'YieldEnabled':
        await this.handleYieldEnabled(event.data);
        break;

      default:
        this.logger.warn(`Unknown event type: ${event.name}`);
    }
  }

  /**
   * Event Handlers
   */
  private async handleMerchantPlanCreated(
    data: any,
    // signature: string,
    // slot: number,
  ) {
    const plan = this.merchantPlanRepo.create({
      planPda: data.planPda || data.plan_pda,
      merchantWallet: data.merchant,
      planId: data.planId || data.plan_id,
      planName: data.planName || data.plan_name,
      mint: data.mint || 'USDC_MINT',
      feeAmount: data.feeAmount?.toString() || data.fee_amount?.toString(),
      paymentInterval:
        data.paymentInterval?.toString() || data.payment_interval?.toString(),
      isActive: true,
      totalSubscribers: 0,
      totalRevenue: '0',
    });

    await this.merchantPlanRepo.save(plan);

    this.logger.log(`✅ Merchant plan created: ${plan.planId}`);
  }

  private async handleSubscriptionWalletCreated(
    data: any,
    // signature: string,
    // slot: number,
  ) {
    const wallet = this.walletRepo.create({
      walletPda: data.walletPda || data.wallet_pda,
      ownerWallet: data.owner,
      mint: data.mint,
      isYieldEnabled: false,
      totalSubscriptions: 0,
      totalSpent: '0',
    });

    await this.walletRepo.save(wallet);

    this.logger.log(`✅ Subscription wallet created: ${wallet.walletPda}`);
  }

  private async handleSubscriptionCreated(
    data: any,
    signature: string,
    slot: number,
  ) {
    const subscription = this.subscriptionRepo.create({
      subscriptionPda: data.subscriptionPda || data.subscription_pda,
      userWallet: data.user,
      subscriptionWalletPda: data.wallet,
      merchantWallet: data.merchant,
      merchantPlanPda: data.planId || data.plan_id,
      mint: 'USDC', // From event or default
      feeAmount: '0', // Will be fetched from plan
      paymentInterval: '0',
      lastPaymentTimestamp: Date.now().toString(),
      totalPaid: '0',
      paymentCount: 0,
      isActive: true,
    });

    await this.subscriptionRepo.save(subscription);

    // Update merchant plan subscriber count
    await this.merchantPlanRepo.increment(
      { planPda: subscription.merchantPlanPda },
      'totalSubscribers',
      1,
    );

    // Update wallet subscription count
    await this.walletRepo.increment(
      { walletPda: subscription.subscriptionWalletPda },
      'totalSubscriptions',
      1,
    );

    // Record transaction
    await this.recordTransaction({
      signature,
      subscriptionPda: subscription.subscriptionPda,
      type: 'subscription_created',
      amount: data.amountPrepaid?.toString() || '0',
      fromWallet: subscription.userWallet,
      toWallet: subscription.merchantWallet,
      slot,
    });

    this.logger.log(`✅ Subscription created: ${subscription.subscriptionPda}`);
  }

  private async handlePaymentExecuted(
    data: any,
    signature: string,
    slot: number,
  ) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionPda: data.subscriptionPda || data.subscription_pda },
    });

    if (subscription) {
      const amount = data.amount?.toString() || '0';

      // Update subscription
      subscription.totalPaid = (
        BigInt(subscription.totalPaid) + BigInt(amount)
      ).toString();
      subscription.paymentCount += 1;
      subscription.lastPaymentTimestamp =
        data.timestamp?.toString() || Date.now().toString();

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
        type: 'payment',
        amount,
        fromWallet: subscription.userWallet,
        toWallet: subscription.merchantWallet,
        slot,
      });

      this.logger.log(
        `✅ Payment executed: ${amount} for ${subscription.subscriptionPda}`,
      );
    }
  }

  private async handleSubscriptionCancelled(
    data: any,
    signature: string,
    slot: number,
  ) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionPda: data.subscriptionPda || data.subscription_pda },
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
        type: 'cancel',
        amount: data.refundAmount?.toString() || '0',
        fromWallet: subscription.merchantWallet,
        toWallet: subscription.userWallet,
        slot,
      });

      this.logger.log(
        `✅ Subscription cancelled: ${subscription.subscriptionPda}`,
      );
    }
  }

  private async handleYieldEnabled(data: any) {
    await this.walletRepo.update(
      { walletPda: data.walletPda || data.wallet_pda },
      {
        isYieldEnabled: true,
        yieldStrategy: data.strategy,
        yieldVault: data.vault,
      },
    );

    this.logger.log(`✅ Yield enabled for wallet: ${data.walletPda}`);
  }

  /**
   * Record transaction in database
   */
  private async recordTransaction(data: {
    signature: string;
    subscriptionPda: string;
    type: string;
    amount: string;
    fromWallet: string;
    toWallet: string;
    slot: number;
  }) {
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
  async syncAllAccounts() {
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

  private async syncMerchantPlans() {
    // Fetch all merchant plan accounts from blockchain
    // Parse and upsert into database
    this.logger.log('Syncing merchant plans...');
  }

  private async syncSubscriptionWallets() {
    this.logger.log('Syncing subscription wallets...');
  }

  private async syncSubscriptions() {
    this.logger.log('Syncing subscriptions...');
  }

  private async loadLastProcessedSlot() {
    // Load from DB or start from current slot
    const connection = this.solanaService.getConnection();
    this.lastProcessedSlot = await connection.getSlot('confirmed');
    this.logger.log(`Starting from slot: ${this.lastProcessedSlot}`);
  }
}
