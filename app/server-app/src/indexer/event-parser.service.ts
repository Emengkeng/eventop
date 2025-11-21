/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { Program, BN, EventParser, Event } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import {
  ProgramEvent,
  SubscriptionWalletCreatedEvent,
  YieldEnabledEvent,
  WalletDepositEvent,
  WalletWithdrawalEvent,
  SubscriptionCreatedEvent,
  PaymentExecutedEvent,
  SubscriptionCancelledEvent,
  YieldClaimedEvent,
} from '../types';

@Injectable()
export class EventParserService {
  private eventParser: EventParser | null = null;

  /**
   * Initialize with your Anchor program
   */
  setProgram(program: Program): void {
    this.eventParser = new EventParser(program.programId, program.coder);
  }

  /**
   * Parse transaction logs and extract typed events
   */
  parseTransactionLogs(logs: string[]): ProgramEvent[] {
    const events: ProgramEvent[] = [];

    if (!this.eventParser) {
      console.warn('EventParser not initialized. Call setProgram() first.');
      return events;
    }

    try {
      // Use Anchor's event parser to extract events from logs
      const parsedEvents = this.eventParser.parseLogs(logs);

      for (const event of parsedEvents) {
        const typedEvent = this.mapAnchorEventToTyped(event);
        if (typedEvent) {
          events.push(typedEvent);
        }
      }
    } catch (error) {
      console.error('Error parsing transaction logs:', error);
    }

    return events;
  }

  /**
   * Map Anchor event to our typed event structure
   */
  private mapAnchorEventToTyped(event: Event): ProgramEvent | null {
    try {
      switch (event.name) {
        case 'SubscriptionWalletCreated':
          return {
            name: 'SubscriptionWalletCreated',
            data: this.parseSubscriptionWalletCreated(event.data),
          };

        case 'YieldEnabled':
          return {
            name: 'YieldEnabled',
            data: this.parseYieldEnabled(event.data),
          };

        case 'WalletDeposit':
          return {
            name: 'WalletDeposit',
            data: this.parseWalletDeposit(event.data),
          };

        case 'WalletWithdrawal':
          return {
            name: 'WalletWithdrawal',
            data: this.parseWalletWithdrawal(event.data),
          };

        case 'SubscriptionCreated':
          return {
            name: 'SubscriptionCreated',
            data: this.parseSubscriptionCreated(event.data),
          };

        case 'PaymentExecuted':
          return {
            name: 'PaymentExecuted',
            data: this.parsePaymentExecuted(event.data),
          };

        case 'SubscriptionCancelled':
          return {
            name: 'SubscriptionCancelled',
            data: this.parseSubscriptionCancelled(event.data),
          };

        case 'YieldClaimed':
          return {
            name: 'YieldClaimed',
            data: this.parseYieldClaimed(event.data),
          };

        default:
          console.warn(`Unknown event type: ${event.name}`);
          return null;
      }
    } catch (error) {
      console.error(`Error mapping event ${event.name}:`, error);
      return null;
    }
  }

  // ============================================
  // EVENT PARSERS
  // ============================================

  private parseSubscriptionWalletCreated(
    data: any,
  ): SubscriptionWalletCreatedEvent {
    return {
      walletPda: new PublicKey(data.walletPda),
      owner: new PublicKey(data.owner),
      mint: new PublicKey(data.mint),
    };
  }

  private parseYieldEnabled(data: any): YieldEnabledEvent {
    return {
      walletPda: new PublicKey(data.walletPda),
      strategy: data.strategy,
      vault: new PublicKey(data.vault),
    };
  }

  private parseWalletDeposit(data: any): WalletDepositEvent {
    return {
      walletPda: new PublicKey(data.walletPda),
      user: new PublicKey(data.user),
      amount: new BN(data.amount),
      depositedToYield: data.depositedToYield,
    };
  }

  private parseWalletWithdrawal(data: any): WalletWithdrawalEvent {
    return {
      walletPda: new PublicKey(data.walletPda),
      user: new PublicKey(data.user),
      amount: new BN(data.amount),
    };
  }

  private parseSubscriptionCreated(data: any): SubscriptionCreatedEvent {
    return {
      subscriptionPda: new PublicKey(data.subscriptionPda),
      user: new PublicKey(data.user),
      wallet: new PublicKey(data.wallet),
      merchant: new PublicKey(data.merchant),
      planId: data.planId,
    };
  }

  private parsePaymentExecuted(data: any): PaymentExecutedEvent {
    return {
      subscriptionPda: new PublicKey(data.subscriptionPda),
      walletPda: new PublicKey(data.walletPda),
      user: new PublicKey(data.user),
      merchant: new PublicKey(data.merchant),
      amount: new BN(data.amount),
      paymentNumber: data.paymentNumber,
    };
  }

  private parseSubscriptionCancelled(data: any): SubscriptionCancelledEvent {
    return {
      subscriptionPda: new PublicKey(data.subscriptionPda),
      walletPda: new PublicKey(data.walletPda),
      user: new PublicKey(data.user),
      merchant: new PublicKey(data.merchant),
      paymentsMade: data.paymentsMade,
    };
  }

  private parseYieldClaimed(data: any): YieldClaimedEvent {
    return {
      walletPda: new PublicKey(data.walletPda),
      user: new PublicKey(data.user),
      amount: new BN(data.amount),
    };
  }
}
