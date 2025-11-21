import { Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { USDC_MINT, PAYER_SECRET_KEY, PROGRAM_ID } from '../config';

@Injectable()
export class SolanaPaymentService {
  private readonly logger = new Logger(SolanaPaymentService.name);
  private connection: Connection;
  private program: Program;
  private payerKeypair: Keypair;

  constructor() {
    // Initialize connection
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed',
    );

    // Load payer keypair (backend wallet that pays for transactions)
    // In production, use a secure key management service
    const secretKey = JSON.parse(PAYER_SECRET_KEY || '[]');
    this.payerKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

    this.logger.log(
      `💰 Payment service initialized with payer: ${this.payerKeypair.publicKey.toString()}`,
    );

    // Load program
    this.initializeProgram();
  }

  private async initializeProgram() {
    const wallet = new Wallet(this.payerKeypair);
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    // Load IDL and create program instance
    const programId = new PublicKey(PROGRAM_ID);
    const idl = await Program.fetchIdl(programId, provider);

    this.program = new Program(idl, programId, provider);

    this.logger.log(`📝 Program loaded: ${programId.toString()}`);
  }

  /**
   * Execute payment for a subscription
   */
  async executePayment(
    subscriptionPda: string,
    subscriptionWalletPda: string,
    merchantWallet: string,
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      // Derive necessary PDAs
      const subscriptionPubkey = new PublicKey(subscriptionPda);
      const walletPubkey = new PublicKey(subscriptionWalletPda);
      const merchantPubkey = new PublicKey(merchantWallet);

      // Get wallet token account
      const walletTokenAccount = await this.getWalletTokenAccount(walletPubkey);

      // Get merchant token account
      const merchantTokenAccount =
        await this.getMerchantTokenAccount(merchantPubkey);

      // Get merchant plan PDA (would need to derive based on your seeds)
      const merchantPlanPda = await this.deriveMerchantPlanPda(merchantPubkey);

      // Build transaction
      const tx = await this.program.methods
        .executePaymentFromWallet()
        .accounts({
          subscriptionState: subscriptionPubkey,
          subscriptionWallet: walletPubkey,
          merchantPlan: merchantPlanPda,
          walletTokenAccount: walletTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          walletYieldVault: PublicKey.default, // If yield enabled
          // Note: No thread account needed anymore!
          tokenProgram: new PublicKey(
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          ),
        })
        .transaction();

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.payerKeypair],
        {
          commitment: 'confirmed',
          skipPreflight: false,
        },
      );

      this.logger.log(`✅ Payment executed: ${signature}`);

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

  private async getWalletTokenAccount(
    walletPda: PublicKey,
  ): Promise<PublicKey> {
    // Derive or fetch the wallet's token account
    const walletAccountInfo =
      await this.program.account.subscriptionWallet.fetch(walletPda);
    // This depends on your program's account structure
    return walletAccountInfo.a;
    // return PublicKey.default; // Placeholder
  }

  private async getMerchantTokenAccount(
    merchantPubkey: PublicKey,
  ): Promise<PublicKey> {
    // Get merchant's associated token account
    const { getAssociatedTokenAddress } = await import('@solana/spl-token');
    const USDC_MINT = new PublicKey(USDC_MINT);

    return getAssociatedTokenAddress(USDC_MINT, merchantPubkey);
  }

  private async deriveMerchantPlanPda(
    merchantPubkey: PublicKey,
  ): Promise<PublicKey> {
    // Derive based on your program's seeds
    // This is a placeholder - adjust to your actual derivation
    return PublicKey.default;
  }
}
