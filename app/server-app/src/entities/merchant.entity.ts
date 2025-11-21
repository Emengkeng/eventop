import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { MerchantPlan } from './merchant-plan.entity';

@Entity('merchants')
export class Merchant {
  @PrimaryColumn()
  walletAddress: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  webhookUrl: string;

  @Column({ nullable: true })
  webhookSecret: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => MerchantPlan, (plan) => plan.merchant)
  plans: MerchantPlan[];
}
