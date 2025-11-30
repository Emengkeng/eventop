import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { RateLimitType } from '../common/rate-limit/rate-limit.config';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
// import { User } from '../auth/user.decorator';

@Controller('subscriptions')
@UseGuards(PrivyAuthGuard, RateLimitGuard)
@RateLimit(RateLimitType.GENERAL)
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get('user/:wallet')
  async getUserSubscriptions(@Param('wallet') wallet: string) {
    return this.subscriptionService.getSubscriptionsByUser(wallet);
  }

  @Get('merchant/:wallet')
  async getMerchantSubscriptions(@Param('wallet') wallet: string) {
    return this.subscriptionService.getSubscriptionsByMerchant(wallet);
  }

  @Get(':pda')
  async getSubscriptionDetail(@Param('pda') pda: string) {
    return this.subscriptionService.getSubscriptionDetail(pda);
  }

  @Get('wallet/:wallet/balance')
  async getWalletBalance(@Param('wallet') wallet: string) {
    return this.subscriptionService.getWalletBalance(wallet);
  }

  @Get('user/:wallet/stats')
  async getUserStats(@Param('wallet') wallet: string) {
    return this.subscriptionService.getSubscriptionStats(wallet);
  }

  @Get('user/:wallet/upcoming')
  async getUpcomingPayments(@Param('wallet') wallet: string) {
    return this.subscriptionService.getUpcomingPayments(wallet);
  }
}
