import { SetMetadata } from '@nestjs/common';
import { RateLimitType } from './rate-limit.config';

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (type: RateLimitType) =>
  SetMetadata(RATE_LIMIT_KEY, type);
