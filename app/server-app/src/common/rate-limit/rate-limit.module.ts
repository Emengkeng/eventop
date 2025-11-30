import { Module, Global } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}
