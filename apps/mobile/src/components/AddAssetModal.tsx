import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";

interface AddAssetModalProps {
  visible: boolean;
  onClose: () => void;
  portfolioId: string;
}

export function AddAssetModal({ visible, onClose, portfolioId }: AddAssetModalProps) {
  const queryClient = useQueryClient();

  const [selectedBroker, setSelectedBroker] = useState<string>("GROWW");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");

  const { mutate: recordTx, isPending } = useMutation({
    mutationFn: async () => {
      // 1. Get or create provider account for this broker
      let providerAccountId: string | undefined;
      try {
        const accRes: any = await apiClient.get("/providers/accounts");
        const accounts = accRes?.accounts || accRes?.data?.accounts || [];
        const existing = accounts.find((a: any) => a.providerCode === selectedBroker);

        if (existing) {
          providerAccountId = existing.id;
        } else {
          const cfg = getBrokerConfig(selectedBroker);
          const newAcc: any = await apiClient.post("/providers/accounts", {
            portfolioId,
            providerCode: selectedBroker,
            accountName: `${cfg.label} Mobile`,
            status: "CONNECTED",
          });
          providerAccountId = newAcc?.id || newAcc?.data?.id;
        }
      } catch {
        // Continue if provider account check fails
      }

      // 2. Post transaction
      return apiClient.post("/transactions", {
        portfolioId,
        symbol: symbol.trim().toUpperCase(),
        type,
        quantity: parseFloat(quantity),
        pricePerUnit: parseFloat(price),
        transactedAt: new Date().toISOString(),
        providerAccountId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      Alert.alert("Asset Added", `${symbol.toUpperCase()} was added successfully!`);
      onClose();
      setSymbol("");
      setQuantity("");
      setPrice("");
    },
    onError: (e: any) => {
      Alert.alert("Error", e?.message || "Could not add asset. Please check values.");
    },
  });

  const handleSubmit = () => {
    if (!symbol.trim())
      return Alert.alert("Missing Field", "Please enter stock symbol (e.g. RELIANCE).");
    if (!quantity || parseFloat(quantity) <= 0)
      return Alert.alert("Invalid Field", "Please enter a valid quantity.");
    if (!price || parseFloat(price) <= 0)
      return Alert.alert("Invalid Field", "Please enter a valid price.");
    recordTx();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Asset to Portfolio</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Select Broker */}
          <Text style={styles.label}>Select Broker Platform</Text>
          <View style={styles.brokerGrid}>
            {CONNECTABLE_BROKERS.map((code) => {
              const cfg = getBrokerConfig(code);
              const active = selectedBroker === code;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => setSelectedBroker(code)}
                  style={[styles.brokerCard, active && styles.brokerCardActive]}
                >
                  <Text style={styles.brokerEmoji}>{cfg.emoji}</Text>
                  <Text style={[styles.brokerName, active && styles.brokerNameActive]}>
                    {cfg.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Buy vs Sell */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === "BUY" && styles.typeBuyActive]}
              onPress={() => setType("BUY")}
            >
              <Text style={[styles.typeText, type === "BUY" && styles.typeTextActive]}>
                Buy Asset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === "SELL" && styles.typeSellActive]}
              onPress={() => setType("SELL")}
            >
              <Text style={[styles.typeText, type === "SELL" && styles.typeTextActive]}>
                Sell Asset
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stock Symbol */}
          <Text style={styles.label}>Stock Symbol / Ticker</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. RELIANCE, INFY, TCS"
            placeholderTextColor="#94a3b8"
            value={symbol}
            onChangeText={(t) => setSymbol(t.toUpperCase())}
            autoCapitalize="characters"
          />

          {/* Quantity */}
          <Text style={styles.label}>Quantity (Shares)</Text>
          <TextInput
            style={styles.input}
            placeholder="10"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
          />

          {/* Buy Price */}
          <Text style={styles.label}>Buy Price per Unit (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="2850.00"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Save Asset</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  closeBtn: { padding: 4 },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8, marginTop: 14 },
  brokerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  brokerCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  brokerCardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  brokerEmoji: { fontSize: 14 },
  brokerName: { fontSize: 13, fontWeight: "600", color: "#475569" },
  brokerNameActive: { color: "#2563eb" },
  typeRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  typeBuyActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  typeSellActive: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  typeText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  typeTextActive: { color: "#ffffff" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
