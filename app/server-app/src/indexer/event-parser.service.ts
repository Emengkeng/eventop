import { Injectable } from '@nestjs/common';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import * as bs58 from 'bs58';

@Injectable()
export class EventParserService {
  private eventParser: EventParser;

  constructor() {
    // Initialize with your program IDL
    // this.eventParser = new EventParser(programId, coder);
  }

  parseTransactionLogs(logs: string[]): any[] {
    const events = [];

    for (const log of logs) {
      try {
        // Look for program log events
        if (log.startsWith('Program log:')) {
          const eventData = this.extractEventData(log);
          if (eventData) {
            events.push(eventData);
          }
        }

        // Look for program data events
        if (log.startsWith('Program data:')) {
          const base64Data = log.replace('Program data: ', '');
          const eventData = this.decodeEventData(base64Data);
          if (eventData) {
            events.push(eventData);
          }
        }
      } catch (error) {
        console.error('Error parsing log:', error);
      }
    }

    return events;
  }

  private extractEventData(log: string): any {
    // Parse custom event formats
    // Example: "Program log: SubscriptionCreated: {...}"
    
    if (log.includes('SubscriptionCreated')) {
      return this.parseSubscriptionCreated(log);
    }
    
    if (log.includes('PaymentExecuted')) {
      return this.parsePaymentExecuted(log);
    }
    
    if (log.includes('SubscriptionCancelled')) {
      return this.parseSubscriptionCancelled(log);
    }

    return null;
  }

  private decodeEventData(base64Data: string): any {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      // Decode using Borsh or custom decoder
      // This depends on your program's event encoding
      return this.decodeEvent(buffer);
    } catch (error) {
      return null;
    }
  }

  private parseSubscriptionCreated(log: string): any {
    // Custom parsing logic for SubscriptionCreated event
    // Adjust based on your actual event format
    const match = log.match(/SubscriptionCreated: (.+)/);
    if (match) {
      try {
        return {
          name: 'SubscriptionCreated',
          data: JSON.parse(match[1]),
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private parsePaymentExecuted(log: string): any {
    const match = log.match(/PaymentExecuted: (.+)/);
    if (match) {
      try {
        return {
          name: 'PaymentExecuted',
          data: JSON.parse(match[1]),
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private parseSubscriptionCancelled(log: string): any {
    const match = log.match(/SubscriptionCancelled: (.+)/);
    if (match) {
      try {
        return {
          name: 'SubscriptionCancelled',
          data: JSON.parse(match[1]),
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private decodeEvent(buffer: Buffer): any {
    // Implement Borsh deserialization based on your event structure
    return null;
  }
}