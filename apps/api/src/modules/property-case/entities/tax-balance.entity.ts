import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'registry', name: 'tax_balance' })
export class TaxBalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'property_case_id' })
  propertyCaseId: string;

  @Column({ name: 'tax_year', type: 'smallint' })
  taxYear: number;

  @Column({ name: 'amount_due', type: 'numeric', precision: 12, scale: 2 })
  amountDue: number;

  @Column({ name: 'amount_paid', type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  balance: number;

  @Column({ default: 'OUTSTANDING' })
  status: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ name: 'last_reconciled_at', nullable: true, type: 'timestamptz' })
  lastReconciledAt: Date;

  @Column({ name: 'reconciled_by', nullable: true })
  reconciledBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
