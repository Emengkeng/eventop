/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PAYER_SECRET_KEY } from '../config';
import localidl from '../idl/subscription_protocol.json';
import type { SubscriptionProtocol } from '../types/subscription_protocol';

interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

@Injectable()
export class SolanaPaymentService {
  private readonly logger = new Logger(SolanaPaymentService.name);
  private connection: Connection;
  private program: Program<SubscriptionProtocol> | null = null;
  private payerKeypair: Keypair;
  private readonly USDC_MINT = new PublicKey(
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  );
  private readonly PROGRAM_ID = new PublicKey(
    'GPVtSfXPiy8y4SkJrMC3VFyKUmGVhMrRbAp2NhiW1Ds2',
  );

  constructor() {
    const rpcUrl =
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    try {
      const secretKey = JSON.parse(PAYER_SECRET_KEY || '[]') as number[];
      if (secretKey.length !== 64) {
        throw new Error('Invalid secret key length');
      }
      this.payerKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

      this.logger.log(
        `Payment service initialized with payer: ${this.payerKeypair.publicKey.toString()}`,
      );

      this.initializeProgram().catch((error) => {
        this.logger.error('Failed to initialize program:', error);
      });
    } catch (error) {
      this.logger.error('Failed to initialize payer keypair:', error);
      throw error;
    }
  }

  private async initializeProgram(): Promise<void> {
    try {
      const wallet = new Wallet(this.payerKeypair);
      const provider = new AnchorProvider(this.connection, wallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      });

      await provider.connection.getVersion();
      // Use the local IDL instead of fetching
      this.program = new Program(localidl as SubscriptionProtocol, provider);

      this.logger.log(`Program loaded: ${this.PROGRAM_ID.toString()}`);
    } catch (error) {
      this.logger.error('Program initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute payment for a subscription
   */
  async executePayment(
    subscriptionPda: string,
    subscriptionWalletPda: string,
    merchantWallet: string,
  ): Promise<PaymentResult> {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      if (!subscriptionPda || !subscriptionWalletPda || !merchantWallet) {
        throw new Error('Missing required parameters');
      }

      const subscriptionPubkey = new PublicKey(subscriptionPda);
      const walletPubkey = new PublicKey(subscriptionWalletPda);
      const merchantPubkey = new PublicKey(merchantWallet);

      // ✅ CORRECT: Use program.account to fetch account data
      const subscriptionAccount =
        await this.program.account.subscriptionState.fetch(subscriptionPubkey);

      // 🚨 SECURITY CHECK: Verify merchant matches
      if (subscriptionAccount.merchant.toString() !== merchantWallet) {
        throw new Error(
          `Merchant mismatch: subscription merchant ${subscriptionAccount.merchant.toString()} != ${merchantWallet}`,
        );
      }

      // Get wallet token account (owned by subscription wallet PDA)
      const walletTokenAccount = await getAssociatedTokenAddress(
        this.USDC_MINT,
        walletPubkey,
        true, // allowOwnerOffCurve = true for PDA
      );

      // Get merchant token account
      const merchantTokenAccount = await getAssociatedTokenAddress(
        this.USDC_MINT,
        merchantPubkey,
      );

      // Get merchant plan PDA from subscription account
      const merchantPlanPda = subscriptionAccount.merchantPlan;

      // ✅ CORRECT: Use program.methods to build and execute instructions
      const tx = await this.program.methods
        .executePaymentFromWallet()
        .accounts({
          // subscriptionState: subscriptionPubkey,
          // subscriptionWallet: walletPubkey,
          merchantPlan: merchantPlanPda,
          walletTokenAccount: walletTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          // tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Add recent blockhash and fee payer
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = this.payerKeypair.publicKey;

      // Send and confirm transaction with retries
      const signature = await this.sendTransactionWithRetry(tx);

      this.logger.log(`Payment executed: ${signature}`);

      return {
        success: true,
        signature,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Payment execution failed:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send transaction with retry logic
   */
  private async sendTransactionWithRetry(
    tx: Transaction,
    maxRetries: number = 3,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const signature = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [this.payerKeypair],
          {
            commitment: 'confirmed',
            skipPreflight: false,
            maxRetries: 0,
          },
        );

        return signature;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Transaction attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));

          const { blockhash, lastValidBlockHeight } =
            await this.connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.lastValidBlockHeight = lastValidBlockHeight;
        }
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /**
   * Verify subscription is valid and active
   */
  async verifySubscription(subscriptionPda: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      const subscriptionPubkey = new PublicKey(subscriptionPda);

      // ✅ CORRECT: Use program.account to fetch
      const subscriptionAccount =
        await this.program.account.subscriptionState.fetch(subscriptionPubkey);

      if (!subscriptionAccount.isActive) {
        return { isValid: false, error: 'Subscription is not active' };
      }

      // Check if payment is due
      const currentTime = Math.floor(Date.now() / 1000);
      const lastPaymentTime =
        subscriptionAccount.lastPaymentTimestamp.toNumber();
      const interval = subscriptionAccount.paymentInterval.toNumber();
      const timeSinceLastPayment = currentTime - lastPaymentTime;

      if (timeSinceLastPayment < interval) {
        return {
          isValid: false,
          error: 'Payment not due yet',
        };
      }

      return { isValid: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Get subscription details
   */
  async getSubscriptionDetails(subscriptionPda: string): Promise<{
    merchant: string;
    merchantPlan: string;
    feeAmount: string;
    lastPaymentTimestamp: string;
    paymentInterval: string;
    isActive: boolean;
  } | null> {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      const subscriptionPubkey = new PublicKey(subscriptionPda);

      // ✅ CORRECT: Use program.account to fetch
      const account =
        await this.program.account.subscriptionState.fetch(subscriptionPubkey);

      return {
        merchant: account.merchant.toString(),
        merchantPlan: account.merchantPlan.toString(),
        feeAmount: account.feeAmount.toString(),
        lastPaymentTimestamp: account.lastPaymentTimestamp.toString(),
        paymentInterval: account.paymentInterval.toString(),
        isActive: account.isActive,
      };
    } catch (error) {
      this.logger.error('Failed to fetch subscription details:', error);
      return null;
    }
  }

  /**
   * Get subscription wallet details
   */
  async getSubscriptionWalletDetails(walletPda: string): Promise<{
    owner: string;
    mint: string;
    totalSubscriptions: number;
    totalSpent: string;
    isYieldEnabled: boolean;
  } | null> {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      const walletPubkey = new PublicKey(walletPda);

      // ✅ CORRECT: Use program.account to fetch wallet data
      const wallet =
        await this.program.account.subscriptionWallet.fetch(walletPubkey);

      return {
        owner: wallet.owner.toString(),
        mint: wallet.mint.toString(),
        totalSubscriptions: wallet.totalSubscriptions,
        totalSpent: wallet.totalSpent.toString(),
        isYieldEnabled: wallet.isYieldEnabled,
      };
    } catch (error) {
      this.logger.error('Failed to fetch wallet details:', error);
      return null;
    }
  }

  /**
   * Get merchant plan details
   */
  async getMerchantPlanDetails(merchantPlanPda: string): Promise<{
    merchant: string;
    planId: string;
    planName: string;
    feeAmount: string;
    paymentInterval: string;
    isActive: boolean;
    totalSubscribers: number;
  } | null> {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      const planPubkey = new PublicKey(merchantPlanPda);

      // ✅ CORRECT: Use program.account to fetch merchant plan data
      const plan = await this.program.account.merchantPlan.fetch(planPubkey);

      return {
        merchant: plan.merchant.toString(),
        planId: plan.planId,
        planName: plan.planName,
        feeAmount: plan.feeAmount.toString(),
        paymentInterval: plan.paymentInterval.toString(),
        isActive: plan.isActive,
        totalSubscribers: plan.totalSubscribers,
      };
    } catch (error) {
      this.logger.error('Failed to fetch merchant plan details:', error);
      return null;
    }
  }
}
