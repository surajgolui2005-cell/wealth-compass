/**
 * CopilotSheet — React Native / Expo
 * ====================================
 *
 * A bottom-sheet AI Portfolio Copilot chatbot for the mobile app.
 *
 * Structure (85% screen height Modal):
 * ┌─────────────────────────────┐
 * │ ─── drag handle ────────── │
 * │ [Bot] Wealth Compass AI [×] │  Header
 * │ ⚠ SEBI disclaimer           │  Always visible
 * │                             │
 * │  Starter chips OR messages  │  Content area
 * │                             │
 * │ [input…………………………] [→]      │  Input bar
 * └─────────────────────────────┘
 *
 * Features:
 * - Floating FAB trigger (bottom-right) with unread badge
 * - Full message history with user/assistant bubbles
 * - Typing indicator (three dots)
 * - 3 starter prompt chips
 * - Trade action cards with broker deep-link handling
 * - Keyboard-aware layout via KeyboardAvoidingView
 * - StyleSheet.create (consistent with MetricCard.tsx pattern)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Constants from "expo-constants";

// ── Config ────────────────────────────────────────────────────────────────────

const COPILOT_BASE_URL = Constants.expoConfig?.extra?.copilotUrl ?? "http://localhost:8001";

const SEBI_DISCLAIMER =
  "AI-generated analytics for educational purposes. Not SEBI-registered investment advice.";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
  suggestedTrades?: SuggestedTrade[];
}

interface SuggestedTrade {
  action: "BUY" | "SELL" | "REBALANCE" | "HOLD";
  asset_class: string;
  symbol: string | null;
  rationale: string;
  suggested_amount_inr: number | null;
  current_weight_pct: number | null;
  target_weight_pct: number | null;
  drift_pct: number | null;
}

// ── Starter prompts ───────────────────────────────────────────────────────────

const STARTERS = [
  {
    id: "risk",
    icon: "📊",
    label: "Analyse portfolio risk",
    message:
      "Analyze my overall portfolio risk — include Sharpe Ratio, Max Drawdown, and Volatility.",
  },
  {
    id: "concentration",
    icon: "⚠️",
    label: "Overconcentration check",
    message:
      "Where am I overconcentrated across brokers? Flag any holding above 20% and suggest rebalancing.",
  },
  {
    id: "tax",
    icon: "💰",
    label: "Tax-saving trades",
    message:
      "Suggest tax-saving trades before 31st March based on my current allocation and unrealized losses.",
  },
];

// ── Broker deep-link map ──────────────────────────────────────────────────────

const BROKER_LINKS: Record<string, (symbol: string) => string> = {
  ZERODHA: (s) => `https://kite.zerodha.com/chart/ext/ciq/NSE/${s}`,
  GROWW: (s) => `https://groww.in/stocks/${s.toLowerCase()}`,
  UPSTOX: (s) => `https://upstox.com/stocks/${s.toLowerCase()}/`,
};

// ── Minimal fallback portfolio context ────────────────────────────────────────

const FALLBACK_CONTEXT = {
  portfolio_id: "mobile-default",
  total_net_worth_inr: 0,
  holdings: [],
  asset_allocation: { Portfolio: 100 },
  target_allocation: null,
  risk_metrics: {
    sharpe_ratio: 0,
    sortino_ratio: 0,
    beta: null,
    max_drawdown_pct: 0,
    annual_volatility_pct: 0,
    hhi: 0,
    diversification_score: 0,
  },
};

// ── INR formatter ─────────────────────────────────────────────────────────────

function formatInr(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.typingRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: dot,
              transform: [
                { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Trade action card ─────────────────────────────────────────────────────────

function TradeCard({ trade }: { trade: SuggestedTrade }) {
  const actionColor =
    trade.action === "BUY"
      ? "#16a34a"
      : trade.action === "SELL"
        ? "#dc2626"
        : trade.action === "REBALANCE"
          ? "#d97706"
          : "#64748b";

  const handleBrokerLink = (broker: string) => {
    const symbol = trade.symbol;
    if (!symbol) return;
    const url = BROKER_LINKS[broker]?.(symbol);
    if (url) Linking.openURL(url).catch(() => Alert.alert("Could not open link"));
  };

  return (
    <View style={[styles.tradeCard, { borderLeftColor: actionColor }]}>
      <View style={styles.tradeHeader}>
        <View style={[styles.actionBadge, { backgroundColor: actionColor + "20" }]}>
          <Text style={[styles.actionText, { color: actionColor }]}>{trade.action}</Text>
        </View>
        <Text style={styles.tradeSymbol}>{trade.symbol ?? trade.asset_class}</Text>
        {trade.drift_pct !== null && (
          <Text style={[styles.drift, { color: trade.drift_pct > 0 ? "#dc2626" : "#16a34a" }]}>
            {trade.drift_pct > 0 ? "+" : ""}
            {trade.drift_pct.toFixed(1)}pp
          </Text>
        )}
      </View>

      <Text style={styles.tradeRationale} numberOfLines={3}>
        {trade.rationale}
      </Text>

      {trade.suggested_amount_inr !== null && (
        <Text style={styles.tradeAmount}>
          Suggested: <Text style={styles.bold}>{formatInr(trade.suggested_amount_inr)}</Text>
          {trade.current_weight_pct !== null &&
            `  Current: ${trade.current_weight_pct.toFixed(1)}%`}
        </Text>
      )}

      {trade.symbol && (
        <View style={styles.brokerRow}>
          {Object.keys(BROKER_LINKS).map((broker) => (
            <TouchableOpacity
              key={broker}
              onPress={() => handleBrokerLink(broker)}
              style={styles.brokerBtn}
              accessibilityLabel={`Open ${trade.symbol} in ${broker}`}
            >
              <Text style={styles.brokerBtnText}>
                {broker === "ZERODHA" ? "Kite ↗" : broker === "GROWW" ? "Groww ↗" : "Upstox ↗"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarEmoji}>🤖</Text>
      </View>
      <View style={styles.assistantBubbleContainer}>
        <View style={styles.assistantBubble}>
          {message.isStreaming ? (
            <TypingDots />
          ) : (
            <Text style={styles.assistantText}>{message.content}</Text>
          )}
        </View>
        {!message.isStreaming && message.suggestedTrades && message.suggestedTrades.length > 0 && (
          <View style={styles.tradesContainer}>
            <Text style={styles.tradeSectionLabel}>SUGGESTED ACTIONS</Text>
            {message.suggestedTrades.map((t, i) => (
              <TradeCard key={i} trade={t} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CopilotSheetProps {
  /** Optional: pass pre-fetched portfolio context from the screen's query cache. */
  portfolioContext?: typeof FALLBACK_CONTEXT;
}

export function CopilotSheet({ portfolioContext = FALLBACK_CONTEXT }: CopilotSheetProps) {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const addMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    if (msg.role === "assistant" && !isOpen) setUnread((n) => n + 1);
  };

  const updateLastMessage = (updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      return [...prev.slice(0, -1), updater(prev[prev.length - 1])];
    });
  };

  const mutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const history = messages
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data } = await axios.post(
        `${COPILOT_BASE_URL}/copilot/chat`,
        {
          user_message: userMessage,
          portfolio_context: portfolioContext,
          conversation_history: history,
        },
        { timeout: 30_000 },
      );
      return data;
    },
    onMutate: (userMessage: string) => {
      addMessage({ id: Date.now() + "u", role: "user", content: userMessage });
      addMessage({ id: Date.now() + "a", role: "assistant", content: "", isStreaming: true });
    },
    onSuccess: (data: any) => {
      updateLastMessage((prev) => ({
        ...prev,
        content: data.answer ?? "",
        suggestedTrades: data.suggested_trades ?? [],
        isStreaming: false,
      }));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: () => {
      updateLastMessage((prev) => ({
        ...prev,
        content: "⚠️ Could not fetch analysis. Please try again.",
        isStreaming: false,
      }));
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || mutation.isPending) return;
    mutation.mutate(input.trim());
    setInput("");
  }, [input, mutation]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnread(0);
  };

  const showStarters = messages.length === 0 && !mutation.isPending;

  return (
    <>
      {/* ── FAB trigger ── */}
      <TouchableOpacity
        accessibilityLabel="Open AI Portfolio Copilot"
        onPress={handleOpen}
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>🤖</Text>
        {unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Bottom sheet modal ── */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.sheet, { height: SHEET_HEIGHT, paddingBottom: insets.bottom }]}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerAvatar}>
                <Text style={{ fontSize: 16 }}>🤖</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>Wealth Compass AI</Text>
                <Text style={styles.headerSub}>Portfolio Copilot</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {messages.length > 0 && (
                <TouchableOpacity onPress={() => setMessages([])} style={styles.iconBtn}>
                  <Text style={styles.iconBtnText}>↺</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SEBI disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>⚠ {SEBI_DISCLAIMER}</Text>
          </View>

          {/* Messages / Starters */}
          {showStarters ? (
            <ScrollView style={styles.flex} contentContainerStyle={styles.startersContainer}>
              <Text style={styles.startersHero}>Ask me anything about your portfolio</Text>
              {STARTERS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.starterChip}
                  onPress={() => mutation.mutate(s.message)}
                  activeOpacity={0.7}
                  accessibilityLabel={s.label}
                >
                  <Text style={styles.starterIcon}>{s.icon}</Text>
                  <Text style={styles.starterLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              style={styles.flex}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your portfolio…"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable={!mutation.isPending}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || mutation.isPending}
              style={[
                styles.sendBtn,
                (!input.trim() || mutation.isPending) && styles.sendBtnDisabled,
              ]}
              accessibilityLabel="Send message"
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendIcon}>→</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6d28d9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  fabIcon: { fontSize: 24 },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  headerSub: { fontSize: 11, color: "#64748b" },
  headerActions: { flexDirection: "row", gap: 4 },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  iconBtnText: { fontSize: 14, color: "#475569", fontWeight: "600" },

  // Disclaimer
  disclaimer: {
    backgroundColor: "#fffbeb",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  disclaimerText: { fontSize: 11, color: "#92400e", lineHeight: 15 },

  // Starters
  flex: { flex: 1 },
  startersContainer: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  startersHero: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  starterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  starterIcon: { fontSize: 20 },
  starterLabel: { fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 },

  // Messages
  messagesList: { padding: 12, gap: 8 },
  userRow: { alignItems: "flex-end", marginVertical: 3 },
  userBubble: {
    backgroundColor: "#4f46e5",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "80%",
  },
  userText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  assistantRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginVertical: 3 },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarEmoji: { fontSize: 14 },
  assistantBubbleContainer: { flex: 1 },
  assistantBubble: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantText: { fontSize: 14, color: "#0f172a", lineHeight: 21 },

  // Typing dots
  typingRow: { flexDirection: "row", gap: 4, paddingVertical: 4 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#94a3b8" },

  // Trade cards
  tradesContainer: { marginTop: 8, gap: 6 },
  tradeSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tradeCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 3,
    padding: 10,
    gap: 6,
  },
  tradeHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  actionBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  actionText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  tradeSymbol: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  drift: { marginLeft: "auto", fontSize: 12, fontWeight: "600" },
  tradeRationale: { fontSize: 12, color: "#475569", lineHeight: 17 },
  tradeAmount: { fontSize: 12, color: "#475569" },
  bold: { fontWeight: "700", color: "#0f172a" },
  brokerRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  brokerBtn: { paddingVertical: 2 },
  brokerBtnText: { fontSize: 12, color: "#4f46e5", fontWeight: "600" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
