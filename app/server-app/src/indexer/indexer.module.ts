import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerService } from './indexer.service';
import { EventParserService } from './event-parser.service';
import { SolanaService } from './solana.service';

import { Merchant } from '../entities/merchant.entity';
import { MerchantPlan } from '../entities/merchant-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionWallet } from '../entities/subscription-wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { IndexerState } from '../entities/indexer-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantPlan,
      Subscription,
      SubscriptionWallet,
      Transaction,
      IndexerState,
    ]),
  ],
  providers: [IndexerService, EventParserService, SolanaService],
  exports: [IndexerService, SolanaService],
})
export class IndexerModule {}
