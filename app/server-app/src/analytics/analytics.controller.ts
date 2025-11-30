import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitType } from '../common/rate-limit/rate-limit.config';

@Controller('analytics')
@UseGuards(PrivyAuthGuard, RateLimitGuard)
@RateLimit(RateLimitType.GENERAL)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get(':wallet/revenue')
  async getRevenueChart(
    @Param('wallet') wallet: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getRevenueChart(
      wallet,
      days ? parseInt(days.toString()) : 30,
    );
  }

  @Get(':wallet/growth')
  async getSubscriberGrowth(
    @Param('wallet') wallet: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getSubscriberGrowth(
      wallet,
      days ? parseInt(days.toString()) : 30,
    );
  }

  @Get(':wallet/churn')
  async getChurnRate(@Param('wallet') wallet: string) {
    return this.analyticsService.getChurnRate(wallet);
  }

  @Get(':wallet/plans')
  async getPlanPerformance(@Param('wallet') wallet: string) {
    return this.analyticsService.getPlanPerformance(wallet);
  }
}
