import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RateLimitType, RATE_LIMIT_CONFIGS } from './rate-limit.config';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(private reflector: Reflector) {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const rateLimitType =
      this.reflector.get<RateLimitType>(RATE_LIMIT_KEY, context.getHandler()) ||
      this.reflector.get<RateLimitType>(RATE_LIMIT_KEY, context.getClass());

    // If no rate limit decorator, allow the request
    if (!rateLimitType) {
      return true;
    }

    const config = RATE_LIMIT_CONFIGS[rateLimitType];
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.generateKey(request, rateLimitType);

    const now = Date.now();
    const entry = this.store.get(key);

    // No entry exists, create one
    if (!entry) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.ttl,
      });
      this.setRateLimitHeaders(request, 1, config.limit, now + config.ttl);
      return true;
    }

    // Entry expired, reset
    if (now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.ttl,
      });
      this.setRateLimitHeaders(request, 1, config.limit, now + config.ttl);
      return true;
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > config.limit) {
      this.logger.warn(
        `Rate limit exceeded for ${key} (${rateLimitType}): ${entry.count}/${config.limit}`,
      );

      throw new HttpException(
        {
          status: false,
          message:
            config.message || 'Too many requests, please try again later.',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.setRateLimitHeaders(
      request,
      entry.count,
      config.limit,
      entry.resetTime,
    );

    return true;
  }

  private generateKey(request: Request, type: RateLimitType): string {
    const ip = this.getClientIp(request);
    const userId = (request as any).user?.userId || 'anonymous';
    return `${type}:${ip}:${userId}`;
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  private setRateLimitHeaders(
    request: Request,
    current: number,
    limit: number,
    resetTime: number,
  ) {
    const response = request.res;
    if (response) {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, limit - current).toString(),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(resetTime / 1000).toString(),
      );
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}
