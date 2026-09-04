import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet } from 'react-native';
import { MetricCard } from '@/components/MetricCard';

const RISK_METRICS = [
  { label: 'Value at Risk (95%, 1D)', value: '₹12,450', severity: 'medium' as const },
  { label: 'CVaR (95%, 1D)', value: '₹18,200', severity: 'medium' as const },
  { label: 'Max Drawdown', value: '-8.50%', severity: 'low' as const },
  { label: 'Annualised Volatility', value: '14.2%', severity: 'low' as const },
  { label: 'Portfolio Risk Score', value: '42 / 100', severity: 'low' as const },
  { label: 'Diversification Score', value: '78 / 100', severity: 'low' as const },
];

const SEVERITY_COLORS = {
  low: { bg: '#f0fdf4', text: '#16a34a', label: 'Low' },
  medium: { bg: '#fffbeb', text: '#d97706', label: 'Medium' },
  high: { bg: '#fef2f2', text: '#dc2626', label: 'High' },
};

export function RiskScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      <Text style={styles.sectionTitle}>Risk Metrics</Text>
      {RISK_METRICS.map(({ label, value, severity }) => {
        const colors = SEVERITY_COLORS[severity];
        return (
          <View key={label} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.metricLabel}>{label}</Text>
              <View style={[styles.severityBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.severityText, { color: colors.text }]}>{colors.label}</Text>
              </View>
            </View>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        );
      })}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Risk Scores</Text>
        <Text style={styles.infoText}>
          Risk metrics are computed by the Quant Engine using historical price data, portfolio weights,
          and correlation matrices. VaR and CVaR are calculated at 95% confidence for a 1-day horizon.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  metricLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, marginRight: 8 },
  severityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  severityText: { fontSize: 11, fontWeight: '700' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  infoCard: {
    backgroundColor: '#eff6ff', borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: '#3b82f6', marginTop: 8,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#1e3a8a', lineHeight: 20 },
});
