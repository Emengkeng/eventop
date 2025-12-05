import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from './privy-auth.middleware';

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  private readonly logger = new Logger(PrivyAuthGuard.name);
  private readonly privyClient: PrivyClient;

  constructor(private configService: ConfigService) {
    const appId = this.configService.get<string>('PRIVY_APP_ID');
    const appSecret = this.configService.get<string>('PRIVY_APP_SECRET');

    if (!appId || !appSecret) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
    }

    this.privyClient = new PrivyClient(appId, appSecret);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // Verify the token
      const verifiedClaims = await this.privyClient.verifyAuthToken(token);

      // Attach user info to request
      request.user = {
        userId: verifiedClaims.userId,
        appId: verifiedClaims.appId,
        sessionId: verifiedClaims.sessionId,
        issuedAt: verifiedClaims.issuedAt,
        expiration: verifiedClaims.expiration,
      };

      // this.logger.log(`✅ Authenticated user: ${verifiedClaims.userId}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error(`❌ Auth failed: ${errorMessage}`);

      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }
}
