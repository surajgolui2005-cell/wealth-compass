import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

interface StockChartModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  name?: string;
  currentPrice?: number;
  pnlPct?: number;
}

const TIMEFRAMES = [
  { label: "1D", interval: "5" },
  { label: "1W", interval: "60" },
  { label: "1M", interval: "D" },
  { label: "3M", interval: "D" },
  { label: "1Y", interval: "W" },
  { label: "5Y", interval: "M" },
];

export function StockChartModal({
  visible,
  onClose,
  symbol,
  name,
  currentPrice,
  pnlPct = 0,
}: StockChartModalProps) {
  const [selectedTf, setSelectedTf] = useState("1D");
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [loadingChart, setLoadingChart] = useState(true);

  const activeInterval = TIMEFRAMES.find((tf) => tf.label === selectedTf)?.interval || "D";

  const isPositive = pnlPct >= 0;
  const upperSymbol = (symbol || "RELIANCE").toUpperCase();

  // TradingView HTML embed string
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #ffffff; overflow: hidden; }
    .tradingview-widget-container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
    {
      "autosize": true,
      "symbol": "NSE:${upperSymbol}",
      "interval": "${activeInterval}",
      "timezone": "Asia/Kolkata",
      "theme": "light",
      "style": "${chartType === "candle" ? "1" : "3"}",
      "locale": "en",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "calendar": false,
      "hide_volume": false,
      "support_host": "https://www.tradingview.com"
    }
    </script>
  </div>
</body>
</html>
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.symbolRow}>
              <Text style={styles.symbolText}>{upperSymbol}</Text>
              <View style={styles.exchangeBadge}>
                <Text style={styles.exchangeBadgeText}>NSE LIVE</Text>
              </View>
            </View>
            <Text style={styles.nameText}>{name || `${upperSymbol} Industries`}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Price & PnL Header */}
        {currentPrice !== undefined && (
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>₹{Number(currentPrice).toLocaleString("en-IN")}</Text>
            <View
              style={[styles.pnlBadge, { backgroundColor: isPositive ? "#ecfdf5" : "#fef2f2" }]}
            >
              <Ionicons
                name={isPositive ? "arrow-up" : "arrow-down"}
                size={13}
                color={isPositive ? "#059669" : "#dc2626"}
              />
              <Text style={[styles.pnlBadgeText, { color: isPositive ? "#059669" : "#dc2626" }]}>
                {Math.abs(pnlPct).toFixed(2)}% Today
              </Text>
            </View>
          </View>
        )}

        {/* Chart Controls Bar */}
        <View style={styles.controlsBar}>
          {/* Candle vs Line Toggle */}
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, chartType === "candle" && styles.toggleBtnActive]}
              onPress={() => setChartType("candle")}
            >
              <Ionicons
                name="bar-chart"
                size={14}
                color={chartType === "candle" ? "#2563eb" : "#64748b"}
              />
              <Text
                style={[styles.toggleBtnText, chartType === "candle" && styles.toggleBtnTextActive]}
              >
                Candles
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, chartType === "line" && styles.toggleBtnActive]}
              onPress={() => setChartType("line")}
            >
              <Ionicons
                name="trending-up"
                size={14}
                color={chartType === "line" ? "#2563eb" : "#64748b"}
              />
              <Text
                style={[styles.toggleBtnText, chartType === "line" && styles.toggleBtnTextActive]}
              >
                Line
              </Text>
            </TouchableOpacity>
          </View>

          {/* Timeframes: 1D, 1W, 1M, 3M, 1Y, 5Y */}
          <View style={styles.tfGroup}>
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf.label}
                style={[styles.tfBtn, selectedTf === tf.label && styles.tfBtnActive]}
                onPress={() => setSelectedTf(tf.label)}
              >
                <Text style={[styles.tfBtnText, selectedTf === tf.label && styles.tfBtnTextActive]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Real-time TradingView Chart via WebView */}
        <View style={styles.chartWrapper}>
          {loadingChart && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading Live TradingView Chart…</Text>
            </View>
          )}
          <WebView
            key={`${upperSymbol}-${selectedTf}-${chartType}`}
            originWhitelist={["*"]}
            source={{ html: htmlContent }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onLoadEnd={() => setLoadingChart(false)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  symbolText: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  exchangeBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exchangeBadgeText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
  nameText: { fontSize: 13, color: "#64748b", marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 20, backgroundColor: "#f1f5f9" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  priceText: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  pnlBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pnlBadgeText: { fontSize: 12, fontWeight: "700" },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  toggleGroup: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  toggleBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  toggleBtnTextActive: { color: "#2563eb" },
  tfGroup: { flexDirection: "row", gap: 4 },
  tfBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  tfBtnActive: { backgroundColor: "#2563eb" },
  tfBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  tfBtnTextActive: { color: "#ffffff" },
  chartWrapper: { flex: 1, backgroundColor: "#ffffff", position: "relative" },
  webView: { flex: 1, backgroundColor: "#ffffff" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
});
