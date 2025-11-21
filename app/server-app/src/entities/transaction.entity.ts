import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  signature: string;

  @Column()
  subscriptionPda: string;

  @Column()
  type: string; // 'payment' | 'deposit' | 'withdrawal' | 'cancel'

  @Column('bigint')
  amount: string;

  @Column()
  fromWallet: string;

  @Column()
  toWallet: string;

  @Column({ type: 'bigint' })
  blockTime: string;

  @Column({ type: 'int' })
  slot: number;

  @Column({ default: 'success' })
  status: string;

  @CreateDateColumn()
  indexedAt: Date;
}
