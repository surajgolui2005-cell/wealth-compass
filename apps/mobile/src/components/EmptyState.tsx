import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>📂</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.button}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconBox: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  icon: { fontSize: 28 },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  description: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, maxWidth: 260, marginBottom: 20 },
  button: {
    backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 20,
    paddingVertical: 12, minHeight: 44, justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
