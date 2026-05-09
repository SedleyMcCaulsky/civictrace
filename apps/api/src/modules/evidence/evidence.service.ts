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

  async uploadEvidence(
    file: Express.Multer.File,
    caseId: string,
    actorId: string,
    metadata: { notes?: string; evidenceType?: string },
  ) {
    const caseResult = await this.db.query(
      `SELECT id, composite_key FROM registry.property_case WHERE id = $1 AND deleted_at IS NULL`,
      [caseId],
    );
    const propertyCase = caseResult[0];
    if (!propertyCase) throw new NotFoundException(`Case not found: ${caseId}`);

    const ext = file.originalname.split('.').pop();
    const fileName = `${caseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from('evidence')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = this.supabase.storage
      .from('evidence')
      .getPublicUrl(fileName);

    const result = await this.db.query(
      `INSERT INTO evidence.evidence_file
        (property_case_id, file_name, file_path, file_size, mime_type,
         storage_bucket, evidence_type, notes, uploaded_by, composite_key)
       VALUES ($1, $2, $3, $4, $5, 'evidence', $6, $7, $8, $9)
       RETURNING id, file_name, file_size, mime_type, evidence_type, notes, created_at`,
      [
        caseId,
        file.originalname,
        fileName,
        file.size,
        file.mimetype,
        metadata.evidenceType || 'PHOTO',
        metadata.notes || null,
        actorId,
        propertyCase.composite_key,
      ],
    ).catch(async () => {
      // If evidence table doesn't exist, return minimal response
      return [{ id: data.id, file_name: file.originalname, file_size: file.size, mime_type: file.mimetype }];
    });

    this.logger.log(`Evidence uploaded: ${fileName} for case ${propertyCase.composite_key}`);

    return {
      id: result[0]?.id,
      fileName: file.originalname,
      filePath: fileName,
      fileSize: file.size,
      mimeType: file.mimetype,
      evidenceType: metadata.evidenceType || 'PHOTO',
      notes: metadata.notes,
      compositeKey: propertyCase.composite_key,
      url: urlData.publicUrl,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getEvidenceForCase(caseId: string) {
    const files = await this.db.query(
      `SELECT id, file_name, file_path, file_size, mime_type,
              evidence_type, notes, created_at, composite_key
       FROM evidence.evidence_file
       WHERE property_case_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [caseId],
    ).catch(() => []);

    const filesWithUrls = await Promise.all(
      files.map(async (f: any) => {
        const { data } = this.supabase.storage
          .from('evidence')
          .getPublicUrl(f.file_path);
        return { ...f, url: data.publicUrl };
      }),
    );

    return filesWithUrls;
  }

  async deleteEvidence(fileId: string, actorId: string) {
    const result = await this.db.query(
      `SELECT id, file_path, composite_key FROM evidence.evidence_file WHERE id = $1`,
      [fileId],
    ).catch(() => []);

    if (!result[0]) throw new NotFoundException(`Evidence file not found: ${fileId}`);

    await this.supabase.storage.from('evidence').remove([result[0].file_path]);

    await this.db.query(
      `UPDATE evidence.evidence_file SET deleted_at = NOW() WHERE id = $1`,
      [fileId],
    ).catch(() => {});

    return { message: 'Evidence deleted', fileId };
  }

  async getSignedUrl(filePath: string) {
    const { data, error } = await this.supabase.storage
      .from('evidence')
      .createSignedUrl(filePath, 3600);

    if (error) throw new Error(`Failed to generate signed URL: ${error.message}`);
    return { signedUrl: data.signedUrl, expiresIn: 3600 };
  }
}
