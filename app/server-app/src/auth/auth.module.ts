import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrivyAuthMiddleware } from './privy-auth.middleware';
import { PrivyAuthGuard } from './privy-auth.guard';

@Module({
  imports: [ConfigModule],
  providers: [PrivyAuthMiddleware, PrivyAuthGuard],
  exports: [PrivyAuthMiddleware, PrivyAuthGuard],
})
export class AuthModule {}
