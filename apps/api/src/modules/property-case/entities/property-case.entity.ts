import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'registry', name: 'property_case' })
export class PropertyCaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'area_id' })
  areaId: string;

  @Column({ name: 'area_code' })
  areaCode: string;

  @Column({ name: 'valuation_number' })
  valuationNumber: string;

  @Column({ name: 'composite_key', nullable: true })
  compositeKey: string;

  @Column({ name: 'owner_name' })
  ownerName: string;

  @Column({ name: 'owner_name_search', nullable: true })
  ownerNameSearch: string;

  @Column({ name: 'property_address' })
  propertyAddress: string;

  @Column({ name: 'property_type' })
  propertyType: string;

  @Column({ nullable: true })
  volume: string;

  @Column({ nullable: true })
  folio: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'import_batch_id', nullable: true })
  importBatchId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
