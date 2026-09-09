import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PlatformBadge } from "@/components/PlatformBadge";
import { StockChartModal } from "@/components/StockChartModal";
import { AddAssetModal } from "@/components/AddAssetModal";
import { getBrokerConfig } from "@/lib/broker-config";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface PortfolioDetailScreenProps {
  portfolioId: string;
  onBack?: () => void;
}

export function PortfolioDetailScreen({ portfolioId, onBack }: PortfolioDetailScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [chartStock, setChartStock] = useState<{
    symbol: string;
    name?: string;
    price?: number;
    pnlPct?: number;
  } | null>(null);

  // Fetch summary (aggregating Groww, Angel One, Zerodha, etc.)
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["portfolio-summary", portfolioId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/portfolios/${portfolioId}/summary`);
      return res?.data ?? res;
    },
  });

  // Fetch holdings
  const {
    data: holdings = [],
    isLoading: holdingsLoading,
    refetch: refetchHoldings,
  } = useQuery({
    queryKey: ["holdings", portfolioId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/portfolios/${portfolioId}/holdings`);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchHoldings()]);
    setRefreshing(false);
  }, [refetchSummary, refetchHoldings]);

  const isPositive = (summary?.totalPnl ?? 0) >= 0;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.portfolioName}>{summary?.name || "Portfolio"}</Text>
          <Text style={styles.subtext}>Multi-Platform Aggregation</Text>
        </View>
        <TouchableOpacity
          onPress={() => setAddModalVisible(true)}
          style={styles.addBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={holdings}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Value Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
              <Text style={styles.totalValueText}>
                {formatCurrency(summary?.totalValue ?? 0, summary?.currency || "INR", true)}
              </Text>

              <View style={styles.pnlRow}>
                <View
                  style={[styles.pnlPill, { backgroundColor: isPositive ? "#ecfdf5" : "#fef2f2" }]}
                >
                  <Ionicons
                    name={isPositive ? "trending-up" : "trending-down"}
                    size={14}
                    color={isPositive ? "#059669" : "#dc2626"}
                  />
                  <Text style={[styles.pnlPillText, { color: isPositive ? "#059669" : "#dc2626" }]}>
                    {isPositive ? "+" : ""}
                    {formatCurrency(summary?.totalPnl ?? 0, summary?.currency || "INR")} (
                    {formatPercent(summary?.totalPnlPct ?? 0)})
                  </Text>
                </View>
                <Text style={styles.holdingsCount}>
                  {holdings.length} {holdings.length === 1 ? "Asset" : "Assets"}
                </Text>
              </View>
            </View>

            {/* Platform Balances Carousel */}
            {summary?.platformBreakdown && summary.platformBreakdown.length > 0 && (
              <View style={styles.platformsSection}>
                <Text style={styles.sectionHeading}>Platforms & Brokers</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.platformsScroll}
                >
                  {summary.platformBreakdown.map((p: any) => {
                    const cfg = getBrokerConfig(p.providerCode);
                    return (
                      <View
                        key={p.providerCode}
                        style={[styles.platformCard, { borderColor: cfg.textColor + "33" }]}
                      >
                        <View style={styles.platTop}>
                          <Text style={styles.platEmoji}>{cfg.emoji}</Text>
                          <Text style={styles.platName}>{cfg.label}</Text>
                        </View>
                        <Text style={styles.platVal}>
                          {formatCurrency(p.totalValue, summary.currency, true)}
                        </Text>
                        <Text style={styles.platCount}>
                          {p.count} {p.count === 1 ? "asset" : "assets"} • {p.percentage.toFixed(0)}
                          %
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <Text style={[styles.sectionHeading, { marginTop: 20, marginBottom: 8 }]}>
              All Assets (Tap Badge to Open Broker)
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const symbol = item.symbol || item.asset?.symbol || "STOCK";
          const name = item.asset?.name || symbol;
          const qty = Number(item.quantity || 0);
          const avgCost = Number(item.avgCostBasis || 0);
          const curPrice = Number(item.currentPrice || avgCost || 0);
          const curVal = Number(item.currentValue || qty * curPrice);
          const pnl = Number(item.unrealizedPnL || curVal - qty * avgCost);
          const pnlPct = Number(
            item.unrealizedPnLPct || (avgCost > 0 ? (pnl / (qty * avgCost)) * 100 : 0),
          );
          const pos = pnl >= 0;
          const providerCode = item.providerAccount?.providerCode || "GROWW";

          return (
            <View style={styles.holdingCard}>
              {/* Top Row: Symbol, Platform Badge, Chart Button */}
              <View style={styles.holdingHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stockSymbol}>{symbol}</Text>
                  <Text style={styles.stockName} numberOfLines={1}>
                    {name}
                  </Text>
                </View>

                {/* Platform Badge (Click opens broker) */}
                <PlatformBadge providerCode={providerCode} symbol={symbol} />

                {/* Live Chart Button */}
                <TouchableOpacity
                  onPress={() =>
                    setChartStock({
                      symbol,
                      name,
                      price: curPrice,
                      pnlPct,
                    })
                  }
                  style={styles.chartBtn}
                >
                  <Ionicons name="trending-up" size={18} color="#2563eb" />
                </TouchableOpacity>
              </View>

              {/* Bottom Row: Qty, Avg Buy, Current Value, P&L */}
              <View style={styles.holdingDetails}>
                <View>
                  <Text style={styles.detailLabel}>Qty • Avg Buy</Text>
                  <Text style={styles.detailVal}>
                    {qty} @ {formatCurrency(avgCost)}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.detailLabel}>Current Value</Text>
                  <Text style={styles.currentValText}>{formatCurrency(curVal)}</Text>
                  <Text style={[styles.pnlText, { color: pos ? "#059669" : "#dc2626" }]}>
                    {pos ? "+" : ""}
                    {formatCurrency(pnl)} ({formatPercent(pnlPct)})
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !holdingsLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Assets Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap &apos;+ Add&apos; to add a stock you bought on Groww, Angel One, or Zerodha.
              </Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          )
        }
      />

      {/* Add Asset Modal */}
      <AddAssetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        portfolioId={portfolioId}
      />

      {/* Live Chart Modal */}
      {chartStock && (
        <StockChartModal
          visible={Boolean(chartStock)}
          onClose={() => setChartStock(null)}
          symbol={chartStock.symbol}
          name={chartStock.name}
          currentPrice={chartStock.price}
          pnlPct={chartStock.pnlPct}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  backBtn: { padding: 4 },
  portfolioName: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  subtext: { fontSize: 12, color: "#64748b" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  listContent: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: "600", textTransform: "uppercase" },
  totalValueText: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginVertical: 6 },
  pnlRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pnlPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pnlPillText: { fontSize: 12, fontWeight: "700" },
  holdingsCount: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  platformsSection: { marginTop: 18 },
  sectionHeading: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 10 },
  platformsScroll: { flexDirection: "row" },
  platformCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 140,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  platTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  platEmoji: { fontSize: 14 },
  platName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  platVal: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  platCount: { fontSize: 11, color: "#64748b", marginTop: 2 },
  holdingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  holdingHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  stockSymbol: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  stockName: { fontSize: 12, color: "#64748b", marginTop: 1 },
  chartBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    marginLeft: 4,
  },
  holdingDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  detailLabel: { fontSize: 11, color: "#94a3b8" },
  detailVal: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 2 },
  currentValText: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  pnlText: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 50 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginTop: 12 },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 40,
    marginTop: 4,
  },
});
