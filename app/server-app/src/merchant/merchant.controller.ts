import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { RateLimitType } from '../common/rate-limit/rate-limit.config';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';

@Controller('merchants')
@UseGuards(PrivyAuthGuard, RateLimitGuard)
@RateLimit(RateLimitType.GENERAL)
export class MerchantController {
  constructor(private merchantService: MerchantService) {}

  @Post('register')
  async register(@Body() data: any) {
    return this.merchantService.registerMerchant(data);
  }

  @Put(':wallet')
  async update(@Param('wallet') wallet: string, @Body() data: any) {
    return this.merchantService.updateMerchant(wallet, data);
  }

  @Get(':wallet')
  async getMerchant(@Param('wallet') wallet: string) {
    return this.merchantService.getMerchant(wallet);
  }

  @Get(':wallet/plans')
  async getPlans(@Param('wallet') wallet: string) {
    return this.merchantService.getMerchantPlans(wallet);
  }

  @Get('plans/:pda')
  async getPlanDetail(@Param('pda') pda: string) {
    return this.merchantService.getPlanDetail(pda);
  }

  @Get('plans/search')
  async searchPlans(@Query() query: any) {
    return this.merchantService.searchPlans(query);
  }

  @Get(':wallet/analytics')
  async getAnalytics(@Param('wallet') wallet: string) {
    return this.merchantService.getMerchantAnalytics(wallet);
  }

  @Get(':wallet/customers')
  async getCustomers(@Param('wallet') wallet: string) {
    return this.merchantService.getCustomers(wallet);
  }

  @Post(':wallet/webhook-secret/regenerate')
  async regenerateSecret(@Param('wallet') wallet: string) {
    return this.merchantService.regenerateWebhookSecret(wallet);
  }
}
