import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import axios from 'axios';
import { ENV } from '../config/env';
import { User } from '../stores/auth.store';
import { DeliveryRepository } from '../db/delivery.repository';
import { SyncEngine } from '../sync/sync.engine';

interface Props {
  user: User | null;
  token: string | null;
  onLogout: () => void;
}

export default function HomeScreen({ user, token, onLogout }: Props) {
  const [todayCount, setTodayCount] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);
  const [areas, setAreas] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [deliveries, pending, areasRes] = await Promise.all([
        DeliveryRepository.getTodaysDeliveries(),
        DeliveryRepository.getPending(),
        axios.get(`${ENV.API_URL}/cases/areas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setTodayCount(deliveries.length);
      setPendingSync(pending.length);
      setAreas(areasRes.data.slice(0, 5));
    } catch (err) {
      console.log('[Home] Load error:', err);
    }
  }

  async function handleSync() {
    await SyncEngine.run();
    await loadData();
    Alert.alert('Sync Complete', 'Deliveries synced.');
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  return (
    <ScrollView style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{user?.fullName?.split(' ')[0]}</Text>
          <Text style={styles.role}>{user?.role}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayCount}</Text>
          <Text style={styles.statLabel}>Today's Deliveries</Text>
        </View>
        <View style={[styles.statCard, pendingSync > 0 && styles.statCardWarning]}>
          <Text style={styles.statNumber}>{pendingSync}</Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton} onPress={handleSync}>
          <Text style={styles.actionButtonText}>🔄 Sync Now</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operational Areas</Text>
        {areas.map((area) => (
          <View key={area.id} style={styles.areaCard}>
            <Text style={styles.areaName}>{area.name}</Text>
            <Text style={styles.areaDetail}>{area.parish} · {area.region}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e293b', padding: 24, paddingTop: 60,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 14, color: '#94a3b8' },
  name: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 2 },
  role: { fontSize: 12, color: '#64748b', marginTop: 2 },
  logoutBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 4 },
  logoutText: { color: '#94a3b8', fontSize: 12 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  statCardWarning: { borderWidth: 1, borderColor: '#fbbf24' },
  statNumber: { fontSize: 32, fontWeight: '700', color: '#1e293b' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 0.5 },
  actionButton: { backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  areaCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: '#1e293b' },
  areaName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  areaDetail: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
