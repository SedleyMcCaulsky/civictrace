import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { DeliveryRepository } from '../db/delivery.repository';
import { ENV } from '../config/env';
import { getStoredToken } from '../stores/auth.store';

let isSyncing = false;

export const SyncEngine = {
  async run() {
    if (isSyncing) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('[Sync] Offline — skipping');
      return;
    }

    isSyncing = true;
    try {
      await SyncEngine.syncDeliveries();
    } catch (err) {
      console.error('[Sync] Failed:', err);
    } finally {
      isSyncing = false;
    }
  },

  async syncDeliveries() {
    const pending = await DeliveryRepository.getPending();
    if (pending.length === 0) return;

    const token = await getStoredToken();
    if (!token) return;

    const payload = pending.map((d) => ({
      propertyCaseId: d.propertyCaseId,
      status: d.status,
      notes: d.notes,
      recipientName: d.recipientName,
      gpsLat: d.gpsLat,
      gpsLng: d.gpsLng,
      gpsAccuracyM: d.gpsAccuracyM,
      deliveredAt: d.deliveredAt,
      assignmentId: d.assignmentId,
      localId: d.localId,
      clientVersion: '1.0',
    }));

    try {
      const response = await axios.post(
        `${ENV.API_URL}/delivery/sync`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30_000,
        },
      );

      const results = response.data;

      for (const synced of results.synced || []) {
        if (synced.localId && !synced.skipped) {
          await DeliveryRepository.markSynced(synced.localId, synced.serverId);
        }
      }

      for (const conflict of results.conflicts || []) {
        if (conflict.localId) {
          await DeliveryRepository.markFailed(conflict.localId, conflict.reason);
        }
      }

      for (const failed of results.failed || []) {
        if (failed.localId) {
          await DeliveryRepository.markFailed(failed.localId, failed.error);
        }
      }

      console.log(`[Sync] Done: ${results.synced?.length || 0} synced`);
    } catch (err: any) {
      for (const d of pending) {
        await DeliveryRepository.markFailed(d.localId, err.message);
      }
    }
  },
};
