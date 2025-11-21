import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from './webhook.service';
import { Merchant } from '../entities/merchant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant]), HttpModule],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
