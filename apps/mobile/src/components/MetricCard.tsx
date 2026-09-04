import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { classifyDelta, formatPercent } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: number;
  isLoading?: boolean;
}

export function MetricCard({ label, value, delta, isLoading = false }: MetricCardProps) {
  if (isLoading) {
    return (
      <View style={[styles.card, styles.skeleton]}>
        <View style={styles.skeletonLabel} />
        <View style={styles.skeletonValue} />
      </View>
    );
  }

  const direction = delta !== undefined ? classifyDelta(delta) : 'neutral';
  const deltaColor =
    direction === 'positive' ? '#22c55e'
    : direction === 'negative' ? '#ef4444'
    : '#94a3b8';

  return (
    <View style={styles.card}>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {delta !== undefined && (
        <Text style={[styles.delta, { color: deltaColor }]}>
          {formatPercent(delta)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    width: '47%',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  skeleton: { opacity: 0.5 },
  skeletonLabel: { height: 12, width: '60%', backgroundColor: '#e2e8f0', borderRadius: 4, marginBottom: 10 },
  skeletonValue: { height: 20, width: '80%', backgroundColor: '#e2e8f0', borderRadius: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 6, lineHeight: 16 },
  value: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  delta: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
