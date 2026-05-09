import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);
  private _supabase: any;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient(
        process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.SUPABASE_SERVICE_KEY || 'placeholder',
      );
    }
    return this._supabase;
  }

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async uploadEvidence(file: Express.Multer.File, caseId: string, actorId: string, metadata: { notes?: string; evidenceType?: string }) {
    const caseResult = await this.db.query(
      `SELECT id, composite_key FROM registry.property_case WHERE id = $1 AND deleted_at IS NULL`,
      [caseId],
    );
    const propertyCase = caseResult[0];
    if (!propertyCase) throw new NotFoundException(`Case not found: ${caseId}`);

    const ext = file.originalname.split('.').pop();
    const storageKey = `${caseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await this.supabase.storage
      .from('evidence')
      .upload(storageKey, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = this.supabase.storage.from('evidence').getPublicUrl(storageKey);

    const result = await this.db.query(
      `INSERT INTO evidence.evidence_file
        (property_case_id, officer_id, file_name, file_type, storage_key, storage_bucket, mime_type, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, 'evidence', $6, $7)
       RETURNING id, file_name, mime_type, file_size_bytes, uploaded_at`,
      [caseId, actorId, file.originalname, metadata.evidenceType || 'PHOTO', storageKey, file.mimetype, file.size],
    );

    this.logger.log(`Evidence uploaded: ${storageKey}`);

    return {
      id: result[0]?.id,
      fileName: file.originalname,
      filePath: storageKey,
      fileSize: file.size,
      mimeType: file.mimetype,
      evidenceType: metadata.evidenceType || 'PHOTO',
      notes: metadata.notes,
      url: urlData.publicUrl,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getEvidenceForCase(caseId: string) {
    const files = await this.db.query(
      `SELECT id, file_name, storage_key, file_size_bytes, mime_type, file_type, uploaded_at
       FROM evidence.evidence_file
       WHERE property_case_id = $1 AND is_valid = true
       ORDER BY uploaded_at DESC`,
      [caseId],
    ).catch(() => []);

    return files.map((f: any) => {
      const { data } = this.supabase.storage.from('evidence').getPublicUrl(f.storage_key);
      return {
        id: f.id,
        file_name: f.file_name,
        file_path: f.storage_key,
        file_size: f.file_size_bytes,
        mime_type: f.mime_type,
        evidence_type: f.file_type,
        notes: null,
        url: data.publicUrl,
        created_at: f.uploaded_at,
      };
    });
  }

  async deleteEvidence(fileId: string, actorId: string) {
    const result = await this.db.query(
      `SELECT id, storage_key FROM evidence.evidence_file WHERE id = $1`,
      [fileId],
    ).catch(() => []);

    if (!result[0]) throw new NotFoundException(`Evidence file not found: ${fileId}`);

    await this.supabase.storage.from('evidence').remove([result[0].storage_key]);

    await this.db.query(
      `UPDATE evidence.evidence_file SET is_valid = false, invalidated_by = $1 WHERE id = $2`,
      [actorId, fileId],
    ).catch(() => {});

    return { message: 'Evidence deleted', fileId };
  }
}
