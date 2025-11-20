import { Injectable, OnModuleInit } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';

@Injectable()
export class SolanaService implements OnModuleInit {
  private connection: Connection;
  private program: Program;
  private programId: PublicKey;

  onModuleInit() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    this.programId = new PublicKey(process.env.PROGRAM_ID);
    
    console.log('✅ Solana connection established');
    console.log('📍 Program ID:', this.programId.toString());
  }

  getConnection(): Connection {
    return this.connection;
  }

  getProgram(): Program {
    return this.program;
  }

  getProgramId(): PublicKey {
    return this.programId;
  }

  async getProgramAccounts(accountType: string) {
    // Fetch all accounts of a specific type
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: accountType, // Account discriminator
          },
        },
      ],
    });

    return accounts;
  }
}