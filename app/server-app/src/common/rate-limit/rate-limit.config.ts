export enum RateLimitType {
  GENERAL = 'general',
  ACTION = 'action',
  AUTHENTICATION = 'authentication',
  SETUP = 'setup',
  CONFIG = 'config',
  AUTH = 'auth',
  HEALTHCHECK = 'healthcheck',
  TEST = 'test',
}

export interface RateLimitConfig {
  ttl: number; // Time to live in milliseconds
  limit: number; // Max requests
  message?: string;
}

export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  [RateLimitType.GENERAL]: {
    ttl: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    message: 'Too many requests from this IP, please try again later.',
  },
  [RateLimitType.ACTION]: {
    ttl: 15 * 60 * 1000,
    limit: 50,
    message: 'Too many action requests, please try again later.',
  },
  [RateLimitType.AUTHENTICATION]: {
    ttl: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many authentication attempts, please try again later.',
  },
  [RateLimitType.SETUP]: {
    ttl: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many setup requests, please try again later.',
  },
  [RateLimitType.CONFIG]: {
    ttl: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many configuration requests, please try again later.',
  },
  [RateLimitType.AUTH]: {
    ttl: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many auth requests, please try again later.',
  },
  [RateLimitType.HEALTHCHECK]: {
    ttl: 15 * 60 * 1000,
    limit: 100,
    message: 'Too many healthcheck requests, please try again later.',
  },
  [RateLimitType.TEST]: {
    ttl: 15 * 60 * 1000,
    limit: 500,
    message: 'Too many test requests, please try again later.',
  },
};
