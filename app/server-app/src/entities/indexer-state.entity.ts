import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('indexer_state')
export class IndexerState {
  @PrimaryColumn()
  key: string;

  @Column('bigint')
  lastProcessedSlot: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncTime: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
