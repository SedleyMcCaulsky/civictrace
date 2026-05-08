import { getDb } from './sqlite';
import * as Crypto from 'expo-crypto';

export interface LocalDelivery {
  localId: string;
  propertyCaseId: string;
  compositeKey?: string;
  status: string;
  notes?: string;
  recipientName?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracyM?: number;
  deliveredAt: string;
  assignmentId?: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
}

export const DeliveryRepository = {

  async save(delivery: Omit<LocalDelivery, 'localId' | 'syncStatus'>): Promise<LocalDelivery> {
    const db = getDb();
    const localId = Crypto.randomUUID();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO local_deliveries
        (local_id, property_case_id, composite_key, status, notes, recipient_name,
         gps_lat, gps_lng, gps_accuracy_m, delivered_at, assignment_id,
         sync_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        localId,
        delivery.propertyCaseId,
        delivery.compositeKey || null,
        delivery.status,
        delivery.notes || null,
        delivery.recipientName || null,
        delivery.gpsLat || null,
        delivery.gpsLng || null,
        delivery.gpsAccuracyM || null,
        delivery.deliveredAt,
        delivery.assignmentId || null,
        now,
      ],
    );

    return { ...delivery, localId, syncStatus: 'PENDING' };
  },

  async getPending(): Promise<LocalDelivery[]> {
    const db = getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM local_deliveries
       WHERE sync_status = 'PENDING' AND retry_count < 5
       ORDER BY created_at ASC`,
    );
    return rows as LocalDelivery[];
  },

  async markSynced(localId: string, serverId: string) {
    const db = getDb();
    await db.runAsync(
      `UPDATE local_deliveries
       SET sync_status = 'SYNCED', server_id = ?, synced_at = ?
       WHERE local_id = ?`,
      [serverId, new Date().toISOString(), localId],
    );
  },

  async markFailed(localId: string, error: string) {
    const db = getDb();
    await db.runAsync(
      `UPDATE local_deliveries
       SET retry_count = retry_count + 1, last_error = ?,
           sync_status = CASE WHEN retry_count >= 4 THEN 'FAILED' ELSE 'PENDING' END
       WHERE local_id = ?`,
      [error, localId],
    );
  },

  async getTodaysDeliveries(): Promise<LocalDelivery[]> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.getAllAsync(
      `SELECT * FROM local_deliveries
       WHERE DATE(created_at) = ?
       ORDER BY created_at DESC`,
      [today],
    );
    return rows as LocalDelivery[];
  },

  async isAlreadyDelivered(propertyCaseId: string): Promise<boolean> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.getAllAsync(
      `SELECT local_id FROM local_deliveries
       WHERE property_case_id = ? AND status = 'DELIVERED' AND DATE(created_at) = ?`,
      [propertyCaseId, today],
    ) as any[];
    return rows.length > 0;
  },
};
