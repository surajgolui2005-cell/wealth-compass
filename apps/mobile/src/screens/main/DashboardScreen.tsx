import React, { useState, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { MetricCard } from "@/components/MetricCard";
import { formatCurrency } from "@/lib/utils";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AaConnectSheet } from "@/components/AaConnectSheet";

interface DashboardSummary {
  totalValue: number;
  dayPnl: number;
  dayPnlPct: number;
  totalHoldings: number;
  portfoliosCount: number;
  currency: string;
  defaultPortfolioId?: string;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [aaSheetVisible, setAaSheetVisible] = useState(false);

  const {
    data: summary,
    isLoading,
    refetch,
  } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const res = await apiClient.get("/portfolios");
      const portfolios: any[] = (res as any).data ?? [];
      const defaultPort = portfolios.find((p: any) => p.isDefault) || portfolios[0];
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
        defaultPortfolioId: defaultPort?.id,
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
      value: "RBI AA Connected",
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subheading}>Multi-broker portfolio tracking & live risk</Text>
        </View>

        <TouchableOpacity
          style={styles.aaBtn}
          onPress={() => {
            if (summary?.defaultPortfolioId) {
              setAaSheetVisible(true);
            } else {
              Alert.alert("Portfolio Needed", "Please create a portfolio first.");
            }
          }}
        >
          <Ionicons name="business" size={16} color="#fff" />
          <Text style={styles.aaBtnText}>Sync AA 🔗</Text>
        </TouchableOpacity>
      </View>

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
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Connected Broker Platforms</Text>
        <TouchableOpacity onPress={() => setAaSheetVisible(true)}>
          <Text style={styles.linkText}>1-Click AA Sync →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brokerScroll}>
        {CONNECTABLE_BROKERS.map((code) => {
          const cfg = getBrokerConfig(code);
          return (
            <TouchableOpacity
              key={code}
              style={[
                styles.brokerChip,
                { backgroundColor: cfg.color, borderColor: cfg.textColor + "4D" },
              ]}
              onPress={() => setAaSheetVisible(true)}
            >
              <Text style={styles.brokerEmoji}>{cfg.emoji}</Text>
              <Text style={[styles.brokerLabel, { color: cfg.textColor }]}>{cfg.label}</Text>
              <Ionicons
                name="open-outline"
                size={12}
                color={cfg.textColor}
                style={{ opacity: 0.7 }}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Quick Action Navigation */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Quick Navigation</Text>

      <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate("PortfoliosTab")}>
        <View style={styles.navIconBg}>
          <Ionicons name="layers" size={20} color="#3b82f6" />
        </View>
        <View style={styles.navContent}>
          <Text style={styles.navTitle}>Portfolio Holdings</Text>

          <Text style={styles.navSub}>View assets tagged by Groww, Angel One & Zerodha</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate("AnalyticsTab")}>
        <View style={styles.navIconBg}>
          <Ionicons name="trending-up" size={20} color="#3b82f6" />
        </View>
        <View style={styles.navContent}>
          <Text style={styles.navTitle}>Performance Analytics</Text>
          <Text style={styles.navSub}>Track XIRR, Sharpe ratio & benchmark comparison</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </TouchableOpacity>

      {summary?.defaultPortfolioId && (
        <AaConnectSheet
          visible={aaSheetVisible}
          onClose={() => setAaSheetVisible(false)}
          portfolioId={summary.defaultPortfolioId}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  subheading: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  aaBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  aaBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  linkText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  brokerScroll: {
    marginBottom: 16,
  },
  brokerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  brokerEmoji: {
    fontSize: 14,
  },
  brokerLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  navCard: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  navIconBg: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    padding: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  navContent: {
    flex: 1,
  },
  navTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  navSub: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
});
