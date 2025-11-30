import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  SubscriptionWallet,
  ACCOUNT_DISCRIMINATORS,
  MerchantPlan,
  SubscriptionState,
  YieldStrategy,
} from '../types';

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private connection!: Connection;
  private program: Program | null = null;
  private programId!: PublicKey;
  private provider!: AnchorProvider;
  private isInitialized = false;

  constructor() {
    const rpcUrl =
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const programIdStr =
      process.env.PROGRAM_ID || 'GPVtSfXPiy8y4SkJrMC3VFyKUmGVhMrRbAp2NhiW1Ds2';

    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    this.programId = new PublicKey(programIdStr);

    const dummyKeypair = Keypair.generate();
    const wallet = new NodeWallet(dummyKeypair);

    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    this.logger.log('✅ Solana connection established');
    this.logger.log(`📍 RPC URL: ${rpcUrl}`);
    this.logger.log(`📍 Program ID: ${this.programId.toString()}`);
  }

  async onModuleInit() {
    try {
      await this.loadProgram();
      this.isInitialized = true;
      this.logger.log('✅ SolanaService fully initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize SolanaService:', error);
    }
  }

  private async loadProgram(): Promise<void> {
    try {
      const idl = await Program.fetchIdl(this.programId, this.provider);
      if (idl) {
        this.program = new Program(idl, this.provider);
        this.logger.log('✅ Program loaded with IDL');
      } else {
        this.logger.warn(
          '⚠️  Program IDL not loaded. Add your IDL to enable typed accounts.',
        );
      }
    } catch (error) {
      this.logger.error('Error loading program IDL:', error);
      throw error;
    }
  }

  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
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

  isReady(): boolean {
    return this.isInitialized && this.program !== null;
  }

  async waitUntilReady(maxAttempts = 10): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.isReady()) {
        this.logger.log('✅ SolanaService is ready');
        return;
      }
      this.logger.warn(
        `⏳ Waiting for SolanaService... (${attempt}/${maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('SolanaService did not initialize in time');
  }

  // ============================================
  // TYPED ACCOUNT FETCHERS
  // ============================================

  async getAllSubscriptionWallets(): Promise<
    Array<{ pubkey: PublicKey; account: SubscriptionWallet }>
  > {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(ACCOUNT_DISCRIMINATORS.SubscriptionWallet),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeSubscriptionWallet(account.data),
    }));
  }

  async getAllMerchantPlans(): Promise<
    Array<{ pubkey: PublicKey; account: MerchantPlan }>
  > {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(ACCOUNT_DISCRIMINATORS.MerchantPlan),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeMerchantPlan(account.data),
    }));
  }

  async getAllSubscriptions(): Promise<
    Array<{ pubkey: PublicKey; account: SubscriptionState }>
  > {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(ACCOUNT_DISCRIMINATORS.SubscriptionState),
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeSubscriptionState(account.data),
    }));
  }

  async getSubscriptionsByUser(
    userPubkey: PublicKey,
  ): Promise<Array<{ pubkey: PublicKey; account: SubscriptionState }>> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(ACCOUNT_DISCRIMINATORS.SubscriptionState),
          },
        },
        {
          memcmp: {
            offset: 8,
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

  async getMerchantPlansByMerchant(
    merchantPubkey: PublicKey,
  ): Promise<Array<{ pubkey: PublicKey; account: MerchantPlan }>> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(ACCOUNT_DISCRIMINATORS.MerchantPlan),
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
    let offset = 8;

    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const mainTokenAccount = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const mint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const yieldVault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

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
