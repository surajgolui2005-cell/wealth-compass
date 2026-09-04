import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { MetricCard } from '@/components/MetricCard';
import { formatCurrency } from '@/lib/utils';

interface DashboardSummary {
  totalValue: number;
  dayPnl: number;
  dayPnlPct: number;
  riskScore: number;
  activeAlerts: number;
  currency: string;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading, refetch } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      // In production: GET /api/v1/portfolios/summary
      const res = await apiClient.get('/portfolios');
      const portfolios: any[] = (res as any).data ?? [];
      const total = portfolios.reduce((sum: number, p: any) => sum + (p.totalValue ?? 0), 0);
      return { totalValue: total, dayPnl: 0, dayPnlPct: 0, riskScore: 0, activeAlerts: 0, currency: 'INR' };
    },
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const greeting = `Hello, ${user?.name?.split(' ')[0] ?? 'there'} 👋`;

  const metricCards = [
    { label: 'Total Value', value: formatCurrency(summary?.totalValue ?? 0, summary?.currency, true), delta: undefined },
    { label: 'Day P&L', value: formatCurrency(summary?.dayPnl ?? 0, summary?.currency), delta: summary?.dayPnlPct },
    { label: 'Risk Score', value: summary ? `${summary.riskScore}/100` : '—', delta: undefined },
    { label: 'Active Alerts', value: summary ? String(summary.activeAlerts) : '—', delta: undefined },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.subheading}>Your portfolio at a glance</Text>

      <View style={styles.grid}>
        {metricCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            delta={card.delta}
            isLoading={isLoading}
          />
        ))}
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {['View Portfolios', 'Risk Center', 'Alert Rules'].map((label) => (
          <View key={label} style={styles.quickActionCard}>
            <Text style={styles.quickActionText}>{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  quickActions: { gap: 10 },
  quickActionCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, minHeight: 52,
    justifyContent: 'center',
  },
  quickActionText: { fontSize: 15, fontWeight: '600', color: '#334155' },
});
