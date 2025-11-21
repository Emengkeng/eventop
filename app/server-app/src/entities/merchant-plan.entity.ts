import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Merchant } from './merchant.entity';

@Entity('merchant_plans')
export class MerchantPlan {
  @PrimaryColumn()
  planPda: string;

  @Column()
  merchantWallet: string;

  @Column()
  planId: string;

  @Column()
  planName: string;

  @Column()
  mint: string;

  @Column('bigint')
  feeAmount: string;

  @Column('bigint')
  paymentInterval: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  totalSubscribers: number;

  @Column({ type: 'bigint', default: '0' })
  totalRevenue: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  features: any;

  @Column({ nullable: true })
  category: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.plans)
  @JoinColumn({ name: 'merchantWallet', referencedColumnName: 'walletAddress' })
  merchant: Merchant;
}
