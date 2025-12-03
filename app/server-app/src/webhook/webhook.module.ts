import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';  // Import HttpModule, not HttpService
import { WebhookService } from './webhook.service';
import { PrismaModule } from '../prisma/prisma.module';  // If you have a PrismaModule

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}