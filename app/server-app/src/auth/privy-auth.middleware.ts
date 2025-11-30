import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrivyClient } from '@privy-io/server-auth';
import { ConfigService } from '@nestjs/config';

// Extend Express Request type to include Privy user data
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    appId: string;
    sessionId: string;
    issuedAt: number;
    expiration: number;
  };
}

@Injectable()
export class PrivyAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PrivyAuthMiddleware.name);
  private readonly privyClient: PrivyClient;

  constructor(private configService: ConfigService) {
    const appId = this.configService.get<string>('PRIVY_APP_ID');
    const appSecret = this.configService.get<string>('PRIVY_APP_SECRET');

    if (!appId || !appSecret) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
    }

    this.privyClient = new PrivyClient(appId, appSecret);
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // Verify the token
      const verifiedClaims = await this.privyClient.verifyAuthToken(token);

      // Attach user info to request
      (req as AuthenticatedRequest).user = {
        userId: verifiedClaims.userId,
        appId: verifiedClaims.appId,
        sessionId: verifiedClaims.sessionId,
        issuedAt: verifiedClaims.issuedAt,
        expiration: verifiedClaims.expiration,
      };

      this.logger.log(`✅ Authenticated user: ${verifiedClaims.userId}`);
      next();
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
