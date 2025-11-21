import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn()
  walletAddress: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'jsonb', nullable: true })
  notificationPreferences: any;

  @Column({ nullable: true })
  pushToken: string;

  @CreateDateColumn()
  createdAt: Date;
}
