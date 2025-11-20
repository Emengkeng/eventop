import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { MerchantService } from './merchant.service';

@Controller('merchants')
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