import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubmitReconciliationDto } from './dto/submit-reconciliation.dto';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async submitBatch(dto: SubmitReconciliationDto, officerId: string) {
    const queryRunner = this.db.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const batchResult = await queryRunner.query(
        `INSERT INTO reconciliation.reconciliation_batch
          (batch_reference, report_period_start, report_period_end,
           submitted_by, total_records, status)
         VALUES ($1, $2::date, $3::date, $4, $5, 'PROCESSING')
         RETURNING id, batch_reference`,
        [dto.batchReference, dto.reportPeriodStart, dto.reportPeriodEnd,
         officerId, dto.records.length],
      );
      const batch = batchResult[0];

      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const record of dto.records) {
        const caseResult = await queryRunner.query(
          `SELECT id, composite_key FROM registry.property_case
           WHERE area_code = $1 AND valuation_number = $2 AND deleted_at IS NULL`,
          [record.rawAreaCode.toUpperCase(), record.rawValuationNumber],
        );
        const propertyCase = caseResult[0];
        const status = propertyCase ? 'MATCHED' : 'UNMATCHED';
        const matchConfidence = propertyCase ? 1.0 : 0.0;

        if (propertyCase) matchedCount++;
        else unmatchedCount++;

        await queryRunner.query(
          `INSERT INTO reconciliation.payment_reconciliation
            (batch_id, property_case_id, raw_area_code, raw_valuation_number,
             raw_owner_name, amount_paid, payment_date, payment_reference,
             years_covered, status, match_confidence, submitted_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9::int[], $10, $11, $12)`,
          [
            batch.id,
            propertyCase?.id || null,
            record.rawAreaCode,
            record.rawValuationNumber,
            record.rawOwnerName || null,
            record.amountPaid,
            record.paymentDate,
            record.paymentReference || null,
            record.yearsCovered,
            status,
            matchConfidence,
            officerId,
          ],
        );
      }

      const totalAmount = dto.records.reduce((s, r) => s + r.amountPaid, 0);

      await queryRunner.query(
        `UPDATE reconciliation.reconciliation_batch
         SET matched_count = $1, unmatched_count = $2,
             total_amount = $3, status = 'COMPLETE', updated_at = NOW()
         WHERE id = $4`,
        [matchedCount, unmatchedCount, totalAmount, batch.id],
      );

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('reconciliation.batch.submitted', {
        batchId: batch.id,
        officerId,
        matched: matchedCount,
        unmatched: unmatchedCount,
      });

      this.logger.log(`Reconciliation batch submitted: ${batch.batch_reference}`);

      return {
        batchId: batch.id,
        batchReference: batch.batch_reference,
        totalRecords: dto.records.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        unmatchedRate: `${((unmatchedCount / dto.records.length) * 100).toFixed(1)}%`,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getBatchSummary(batchId: string) {
    const batchResult = await this.db.query(
      `SELECT b.*, u.full_name as submitted_by_name
       FROM reconciliation.reconciliation_batch b
       JOIN identity.user u ON u.id = b.submitted_by
       WHERE b.id = $1`,
      [batchId],
    );
    const batch = batchResult[0];

    const records = await this.db.query(
      `SELECT pr.id, pr.raw_area_code, pr.raw_valuation_number,
              pr.amount_paid, pr.payment_date, pr.years_covered,
              pr.status, pr.match_confidence,
              pc.composite_key, pc.property_address
       FROM reconciliation.payment_reconciliation pr
       LEFT JOIN registry.property_case pc ON pc.id = pr.property_case_id
       WHERE pr.batch_id = $1
       ORDER BY pr.status, pr.raw_area_code`,
      [batchId],
    );

    return { batch, records };
  }

  async getRecentBatches(officerId: string) {
    return this.db.query(
      `SELECT b.id, b.batch_reference, b.report_period_start, b.report_period_end,
              b.total_records, b.matched_count, b.unmatched_count,
              b.total_amount, b.status, b.created_at
       FROM reconciliation.reconciliation_batch b
       WHERE b.submitted_by = $1
       ORDER BY b.created_at DESC
       LIMIT 20`,
      [officerId],
    );
  }
}
