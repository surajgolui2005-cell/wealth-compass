import React, { useState, useCallback } from "react";
import {
  FlatList,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { PortfolioDetailScreen } from "./PortfolioDetailScreen";
import { Ionicons } from "@expo/vector-icons";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  description?: string;
  totalValue: number;
}

export function PortfoliosScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const {
    data: portfolios = [],
    isLoading,
    refetch,
  } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const res = await apiClient.get("/portfolios");
      return (res as any).data ?? res.data ?? [];
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // If a portfolio is tapped, render the full multi-platform detail screen
  if (selectedPortfolioId) {
    return (
      <PortfolioDetailScreen
        portfolioId={selectedPortfolioId}
        onBack={() => setSelectedPortfolioId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, portfolios.length === 0 && styles.emptyContainer]}
      data={portfolios}
      keyExtractor={(p) => p.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
      ListEmptyComponent={
        <EmptyState
          title="No portfolios yet"
          description="Create a portfolio from the web dashboard or add an asset to start tracking."
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => setSelectedPortfolioId(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Portfolio ${item.name}`}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.portfolioName}>{item.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.currency}</Text>
            </View>
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          <View style={styles.valueRow}>
            <View>
              <Text style={styles.value}>
                {formatCurrency(item.totalValue ?? 0, item.currency, true)}
              </Text>
              <Text style={styles.valueLabel}>Aggregated value across brokers</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </View>
        </TouchableOpacity>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  portfolioName: { fontSize: 16, fontWeight: "700", color: "#0f172a", flex: 1 },
  badge: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { color: "#3b82f6", fontSize: 12, fontWeight: "600" },
  description: { fontSize: 13, color: "#64748b", marginBottom: 8 },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  value: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  valueLabel: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  separator: { height: 12 },
});
