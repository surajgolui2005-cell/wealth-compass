import React, { useState, useCallback } from 'react';
import { FlatList, RefreshControl, View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';

interface AlertRule {
  id: string;
  name: string;
  alertType: string;
  isActive: boolean;
  cooldownDurationMinutes: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  DRAWDOWN_LIMIT: 'Drawdown',
  PORTFOLIO_REBALANCE: 'Rebalance',
  RISK_SCORE_SPIKE: 'Volatility',
};

export function AlertsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: rules = [], isLoading, refetch } = useQuery<AlertRule[]>({
    queryKey: ['alerts', 'rules'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts/rules');
      return (res as any).data ?? res.data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/alerts/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function confirmDelete(rule: AlertRule) {
    Alert.alert(
      'Delete Alert Rule',
      `Are you sure you want to delete "${rule.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(rule.id) },
      ],
    );
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, rules.length === 0 && styles.emptyContainer]}
      data={rules}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      ListEmptyComponent={
        <EmptyState title="No alert rules" description="Set up alert rules on the web dashboard to receive notifications." />
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.ruleName}>{item.name}</Text>
              <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, item.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {item.isActive ? 'Active' : 'Paused'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.meta}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{TYPE_LABELS[item.alertType] ?? item.alertType}</Text>
            </View>
            <Text style={styles.metaText}>
              {item.cooldownDurationMinutes}m cooldown · {item.triggerCount} triggers
            </Text>
          </View>
          {item.lastTriggeredAt && (
            <Text style={styles.lastFired}>Last fired: {formatDate(item.lastTriggeredAt)}</Text>
          )}
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 8 },
  ruleName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeActive: { backgroundColor: '#f0fdf4' },
  badgeInactive: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextActive: { color: '#16a34a' },
  badgeTextInactive: { color: '#64748b' },
  deleteBtn: { padding: 4, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 16, color: '#94a3b8', fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11, color: '#3b82f6', fontWeight: '600' },
  metaText: { fontSize: 12, color: '#94a3b8' },
  lastFired: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
});
