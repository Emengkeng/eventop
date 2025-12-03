import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { EventParserService } from './event-parser.service';
import { SolanaService } from './solana.service';

@Module({
  providers: [IndexerService, EventParserService, SolanaService],
  exports: [IndexerService, SolanaService],
})
export class IndexerModule {}
