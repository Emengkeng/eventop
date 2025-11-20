import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const SOLANA_RPC = 'https://api.devnet.solana.com';

export class SolanaService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(SOLANA_RPC, 'confirmed');
  }

  async connectWallet() {
    try {
      const result = await transact(async (wallet) => {
        const authorization = await wallet.authorize({
          cluster: 'devnet',
          identity: {
            name: 'Subscription Wallet',
            uri: 'https://subscriptionwallet.app',
            icon: 'icon.png',
          },
        });

        return {
          publicKey: authorization.accounts[0].address,
          authToken: authorization.auth_token,
        };
      });

      return result;
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }

  async signAndSendTransaction(transaction: Transaction) {
    try {
      const result = await transact(async (wallet) => {
        const signedTransactions = await wallet.signTransactions({
          transactions: [transaction.serialize({ requireAllSignatures: false })],
        });

        const signedTx = Transaction.from(signedTransactions[0]);
        const signature = await this.connection.sendRawTransaction(
          signedTx.serialize()
        );

        await this.connection.confirmTransaction(signature, 'confirmed');

        return signature;
      });

      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async getBalance(publicKey: PublicKey) {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1_000_000_000; // Convert lamports to SOL
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  disconnect() {
    // Mobile Wallet Adapter doesn't require explicit disconnect
    console.log('Wallet disconnected');
  }
}

export const solanaService = new SolanaService();