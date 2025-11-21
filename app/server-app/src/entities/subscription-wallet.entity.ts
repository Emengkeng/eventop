import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('subscription_wallets')
export class SubscriptionWallet {
  @PrimaryColumn()
  walletPda: string;

  @Column()
  ownerWallet: string;

  @Column()
  mint: string;

  @Column({ default: false })
  isYieldEnabled: boolean;

  @Column({ nullable: true })
  yieldStrategy: string;

  @Column({ nullable: true })
  yieldVault: string;

  @Column({ type: 'int', default: 0 })
  totalSubscriptions: number;

  @Column({ type: 'bigint', default: '0' })
  totalSpent: string;

  @CreateDateColumn()
  createdAt: Date;
}
