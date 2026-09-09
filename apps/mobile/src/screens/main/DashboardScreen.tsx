import React, { useState, useCallback } from "react";
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { MetricCard } from "@/components/MetricCard";
import { formatCurrency } from "@/lib/utils";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

interface DashboardSummary {
  totalValue: number;
  dayPnl: number;
  dayPnlPct: number;
  totalHoldings: number;
  portfoliosCount: number;
  currency: string;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: summary,
    isLoading,
    refetch,
  } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const res = await apiClient.get("/portfolios");
      const portfolios: any[] = (res as any).data ?? [];
      const total = portfolios.reduce(
        (sum: number, p: any) => sum + (Number(p.totalValue) || 0),
        0,
      );
      const holdingsCount = portfolios.reduce(
        (sum: number, p: any) => sum + (p._count?.holdings || 0),
        0,
      );
      return {
        totalValue: total,
        dayPnl: 0,
        dayPnlPct: 0,
        totalHoldings: holdingsCount,
        portfoliosCount: portfolios.length,
        currency: "INR",
      };
    },
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const greeting = `Hello, ${user?.name?.split(" ")[0] ?? "Investor"} 👋`;

  const metricCards = [
    {
      label: "Total Net Worth",
      value: formatCurrency(summary?.totalValue ?? 0, summary?.currency, true),
      delta: undefined,
    },
    {
      label: "Active Portfolios",
      value: String(summary?.portfoliosCount ?? 0),
      delta: undefined,
    },
    {
      label: "Total Asset Holdings",
      value: String(summary?.totalHoldings ?? 0),
      delta: undefined,
    },
    {
      label: "Broker Integrations",
      value: "Groww & Angel One",
      delta: undefined,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.subheading}>Multi-broker portfolio tracking & live risk</Text>

      {/* Metric Cards Grid */}
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

      {/* Supported / Integrated Brokers Strip */}
      <Text style={styles.sectionTitle}>Connected Brokers</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brokersScroll}>
        {CONNECTABLE_BROKERS.map((code) => {
          const cfg = getBrokerConfig(code);
          return (
            <View key={code} style={[styles.brokerChip, { borderColor: cfg.textColor + "33" }]}>
              <Text style={styles.brokerChipEmoji}>{cfg.emoji}</Text>
              <Text style={styles.brokerChipText}>{cfg.label}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Quick Navigation Actions */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Quick Navigation</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate("Portfolios")}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <View style={[styles.actionIcon, { backgroundColor: "#eff6ff" }]}>
              <Ionicons name="briefcase" size={20} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.quickActionText}>View Holdings & Platforms</Text>
              <Text style={styles.quickActionSub}>Manage Groww, Angel One & Zerodha stocks</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate("Risk")}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <View style={[styles.actionIcon, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="shield-checkmark" size={20} color="#16a34a" />
            </View>
            <View>
              <Text style={styles.quickActionText}>Risk & Diversification Center</Text>
              <Text style={styles.quickActionSub}>VaR, portfolio beta & max drawdown</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate("Alerts")}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <View style={[styles.actionIcon, { backgroundColor: "#fffbeb" }]}>
              <Ionicons name="notifications" size={20} color="#d97706" />
            </View>
            <View>
              <Text style={styles.quickActionText}>Price & Volatility Alerts</Text>
              <Text style={styles.quickActionSub}>Real-time notification rules</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subheading: { fontSize: 13, color: "#64748b", marginBottom: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  brokersScroll: { flexDirection: "row", marginBottom: 10 },
  brokerChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  brokerChipEmoji: { fontSize: 13 },
  brokerChipText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  quickActions: { gap: 10 },
  quickActionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  quickActionSub: { fontSize: 12, color: "#64748b", marginTop: 1 },
});
