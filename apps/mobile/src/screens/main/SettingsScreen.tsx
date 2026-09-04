import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import Constants from 'expo-constants';

export function SettingsScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? 'U'}
          </Text>
        </View>
        <View>
          <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
        </View>
      </View>

      {/* Settings rows */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        {[
          { label: 'Email', value: user?.email ?? '—' },
          { label: 'Account Status', value: user?.status ?? '—' },
        ].map(({ label, value }) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{version}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>API</Text>
          <Text style={styles.rowValue}>{Constants.expoConfig?.extra?.apiBaseUrl ?? 'localhost:3000'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 20,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  profileEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', minHeight: 44 },
  rowLabel: { fontSize: 15, color: '#334155' },
  rowValue: { fontSize: 14, color: '#64748b', maxWidth: '55%', textAlign: 'right' },
  logoutButton: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, minHeight: 52, justifyContent: 'center',
    borderWidth: 1, borderColor: '#fca5a5',
  },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
});
