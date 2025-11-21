import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscriptions')
export class Subscription {
  @PrimaryColumn()
  subscriptionPda: string;

  @Column()
  userWallet: string;

  @Column()
  subscriptionWalletPda: string;

  @Column()
  merchantWallet: string;

  @Column()
  merchantPlanPda: string;

  @Column()
  mint: string;

  @Column('bigint')
  feeAmount: string;

  @Column('bigint')
  paymentInterval: string;

  @Column({ type: 'bigint' })
  lastPaymentTimestamp: string;

  @Column({ type: 'bigint', default: '0' })
  totalPaid: string;

  @Column({ type: 'int', default: 0 })
  paymentCount: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;
}
