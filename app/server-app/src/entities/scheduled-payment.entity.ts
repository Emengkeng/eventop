import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('scheduled_payments')
export class ScheduledPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  subscriptionPda: string;

  @Column()
  merchantWallet: string;

  @Column('bigint')
  amount: string;

  @Column()
  @Index()
  scheduledFor: Date;

  @Column({ default: 'pending' })
  @Index()
  status: string; // 'pending' | 'processing' | 'completed' | 'failed'

  @Column({ nullable: true })
  signature: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  executedAt: Date;
}
