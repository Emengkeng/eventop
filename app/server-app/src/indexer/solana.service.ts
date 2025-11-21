import { Injectable, OnModuleInit } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { Keypair } from '@solana/web3.js';
import {
  SubscriptionWallet,
  ACCOUNT_DISCRIMINATORS,
  MerchantPlan,
  SubscriptionState,
  YieldStrategy,
} from '../types';

@Injectable()
export class SolanaService implements OnModuleInit {
  private connection: Connection;
  private program: Program | null = null;
  private programId: PublicKey;
  private provider: AnchorProvider;

  async onModuleInit() {
    const rpcUrl =
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const programIdStr =
      process.env.PROGRAM_ID || '7sfgAWayriXLDnDvseZTNo3DvwVV7SrybvVFhjJgjkJH';

    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    this.programId = new PublicKey(programIdStr);

    // Create a dummy wallet for read-only operations
    const dummyKeypair = Keypair.generate();
    const wallet = new NodeWallet(dummyKeypair);

    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    console.log('✅ Solana connection established');
    console.log('📍 RPC URL:', rpcUrl);
    console.log('📍 Program ID:', this.programId.toString());

    // Load the program IDL if available
    await this.loadProgram();
  }

  /**
   * Load the Anchor program with IDL
   */
  private async loadProgram(): Promise<void> {
    try {
      // You need to import your IDL JSON file
      // const idl = await Program.fetchIdl(this.programId, this.provider);
      // if (idl) {
      //   this.program = new Program(idl, this.programId, this.provider);
      //   console.log('✅ Program loaded with IDL');
      // }

      // For now, placeholder
      console.log(
        '⚠️  Program IDL not loaded. Add your IDL to enable typed accounts.',
      );
    } catch (error) {
      console.error('Error loading program IDL:', error);
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getProgram(): Program | null {
    return this.program;
  }

  getProgramId(): PublicKey {
    return this.programId;
  }

  getProvider(): AnchorProvider {
    return this.provider;
  }

  // ============================================
  // TYPED ACCOUNT FETCHERS
  // ============================================

  /**
   * Fetch all Subscription Wallet accounts
   */
  async getAllSubscriptionWallets(): Promise<
    Array<{ pubkey: PublicKey; account: SubscriptionWallet }>
  > {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ACCOUNT_DISCRIMINATORS.SubscriptionWallet.toString('base64'),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeSubscriptionWallet(account.data),
    }));
  }

  /**
   * Fetch all Merchant Plan accounts
   */
  async getAllMerchantPlans(): Promise<
    Array<{ pubkey: PublicKey; account: MerchantPlan }>
  > {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ACCOUNT_DISCRIMINATORS.MerchantPlan.toString('base64'),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeMerchantPlan(account.data),
    }));
  }

  /**
   * Fetch all Subscription State accounts
   */
  async getAllSubscriptions(): Promise<
    Array<{ pubkey: PublicKey; account: SubscriptionState }>
  > {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ACCOUNT_DISCRIMINATORS.SubscriptionState.toString('base64'),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeSubscriptionState(account.data),
    }));
  }

  /**
   * Fetch subscriptions by user
   */
  async getSubscriptionsByUser(
    userPubkey: PublicKey,
  ): Promise<Array<{ pubkey: PublicKey; account: SubscriptionState }>> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ACCOUNT_DISCRIMINATORS.SubscriptionState.toString('base64'),
          },
        },
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: userPubkey.toBase58(),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeSubscriptionState(account.data),
    }));
  }

  /**
   * Fetch merchant plans by merchant
   */
  async getMerchantPlansByMerchant(
    merchantPubkey: PublicKey,
  ): Promise<Array<{ pubkey: PublicKey; account: MerchantPlan }>> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: ACCOUNT_DISCRIMINATORS.MerchantPlan.toString('base64'),
          },
        },
        {
          memcmp: {
            offset: 8,
            bytes: merchantPubkey.toBase58(),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeMerchantPlan(account.data),
    }));
  }

  // ============================================
  // ACCOUNT DECODERS
  // ============================================

  private decodeSubscriptionWallet(data: Buffer): SubscriptionWallet {
    // Skip 8-byte discriminator
    let offset = 8;

    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const mainTokenAccount = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const mint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const yieldVault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // YieldStrategy enum (1 byte)
    const yieldStrategyByte = data.readUInt8(offset);
    offset += 1;
    const yieldStrategy = this.decodeYieldStrategy(yieldStrategyByte);

    const isYieldEnabled = data.readUInt8(offset) === 1;
    offset += 1;

    const totalSubscriptions = data.readUInt32LE(offset);
    offset += 4;

    const totalSpent = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const bump = data.readUInt8(offset);

    return {
      owner,
      mainTokenAccount,
      mint,
      yieldVault,
      yieldStrategy,
      isYieldEnabled,
      totalSubscriptions,
      totalSpent,
      bump,
    };
  }

  private decodeMerchantPlan(data: Buffer): MerchantPlan {
    let offset = 8;

    const merchant = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const mint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // String with length prefix (4 bytes) + content
    const planIdLen = data.readUInt32LE(offset);
    offset += 4;
    const planId = data.slice(offset, offset + planIdLen).toString('utf8');
    offset += planIdLen;

    const planNameLen = data.readUInt32LE(offset);
    offset += 4;
    const planName = data.slice(offset, offset + planNameLen).toString('utf8');
    offset += planNameLen;

    const feeAmount = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const paymentInterval = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    const totalSubscribers = data.readUInt32LE(offset);
    offset += 4;

    const bump = data.readUInt8(offset);

    return {
      merchant,
      mint,
      planId,
      planName,
      feeAmount,
      paymentInterval,
      isActive,
      totalSubscribers,
      bump,
    };
  }

  private decodeSubscriptionState(data: Buffer): SubscriptionState {
    let offset = 8;

    const user = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const subscriptionWallet = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const merchant = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const mint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const merchantPlan = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const feeAmount = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const paymentInterval = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const lastPaymentTimestamp = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const totalPaid = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const paymentCount = data.readUInt32LE(offset);
    offset += 4;

    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    const bump = data.readUInt8(offset);

    return {
      user,
      subscriptionWallet,
      merchant,
      mint,
      merchantPlan,
      feeAmount,
      paymentInterval,
      lastPaymentTimestamp,
      totalPaid,
      paymentCount,
      isActive,
      bump,
    };
  }

  private decodeYieldStrategy(byte: number): YieldStrategy {
    switch (byte) {
      case 0:
        return YieldStrategy.None;
      case 1:
        return YieldStrategy.MarginfiLend;
      case 2:
        return YieldStrategy.KaminoLend;
      case 3:
        return YieldStrategy.SolendPool;
      case 4:
        return YieldStrategy.DriftDeposit;
      default:
        return YieldStrategy.None;
    }
  }
}
