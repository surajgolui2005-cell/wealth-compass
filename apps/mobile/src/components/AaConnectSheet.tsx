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
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface AaConnectSheetProps {
  visible: boolean;
  onClose: () => void;
  portfolioId: string;
}

export function AaConnectSheet({ visible, onClose, portfolioId }: AaConnectSheetProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"MOBILE" | "CONSENT" | "FETCHING" | "SUCCESS">("MOBILE");
  const [mobileNumber, setMobileNumber] = useState("9999999999");
  const [otp, setOtp] = useState("123456");
  const [consentId, setConsentId] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [importedHoldings, setImportedHoldings] = useState<any[]>([]);

  // Create Consent Mutation
  const createConsentMutation = useMutation({
    mutationFn: async () => {
      const res: any = await apiClient.post("/aa/consent", {
        mobileNumber,
        portfolioId,
      });
      return res?.data?.data || res?.data || res;
    },
    onSuccess: (data) => {
      setConsentId(data?.consentId);
      setConsentUrl(data?.consentUrl);
      setStep("CONSENT");
    },
    onError: (err: any) => {
      Alert.alert("Consent Error", err?.message || "Failed to initiate Setu AA consent.");
    },
  });

  // Fetch Holdings Mutation
  const fetchHoldingsMutation = useMutation({
    mutationFn: async (cid: string) => {
      const res: any = await apiClient.post(`/aa/consent/${cid}/fetch`, {
        portfolioId,
      });
      return res?.data?.data || res?.data || res;
    },
    onSuccess: (data) => {
      setImportedHoldings(data?.holdings || []);
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setStep("SUCCESS");
    },
    onError: (err: any) => {
      Alert.alert("Sync Error", err?.message || "Failed to fetch demat holdings.");
      setStep("CONSENT");
    },
  });

  const handleStartConsent = () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      Alert.alert("Invalid Number", "Please enter a 10-digit mobile number.");
      return;
    }
    createConsentMutation.mutate();
  };

  const handleApprove = () => {
    setStep("FETCHING");
    if (consentId) {
      fetchHoldingsMutation.mutate(consentId);
    }
  };

  const handleReset = () => {
    setStep("MOBILE");
    setConsentId(null);
    setConsentUrl(null);
    setImportedHoldings([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="account-balance" size={24} color="#3b82f6" />
              <Text style={styles.title}>🏦 1-Click Demat Sync</Text>
            </View>
            <TouchableOpacity onPress={handleReset}>
              <Ionicons name="close-circle" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            RBI Account Aggregator (Setu Gateway) — Sync Groww, AngelOne & Zerodha holdings
          </Text>

          <ScrollView style={styles.content}>
            {step === "MOBILE" && (
              <View style={styles.section}>
                <View style={styles.banner}>
                  <Ionicons name="shield-checkmark" size={20} color="#60a5fa" />
                  <Text style={styles.bannerText}>
                    Consolidates CDSL/NSDL stock holdings across all brokers using a single OTP
                    flow.
                  </Text>
                </View>

                <Text style={styles.label}>Registered Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile"
                  placeholderTextColor="#64748b"
                />
                <Text style={styles.hint}>💡 Sandbox Test Number: 9999999999</Text>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleStartConsent}
                  disabled={createConsentMutation.isPending}
                >
                  {createConsentMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Initiate Setu AA Sync →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === "CONSENT" && (
              <View style={styles.section}>
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={22} color="#34d399" />
                  <Text style={styles.successBannerText}>
                    Setu AA Consent Created ({consentId?.substring(0, 10)}...)
                  </Text>
                </View>

                <Text style={styles.label}>Enter Sandbox OTP</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.hint}>Static Test OTP: 123456 (Setu FIP-2)</Text>

                {consentUrl && (
                  <TouchableOpacity
                    style={styles.webBtn}
                    onPress={() => Linking.openURL(consentUrl)}
                  >
                    <Ionicons name="open-outline" size={16} color="#60a5fa" />
                    <Text style={styles.webBtnText}>Open Setu Webview Browser Screen</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                  <Text style={styles.btnText}>Approve & Sync Holdings</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === "FETCHING" && (
              <View style={styles.centerSection}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingTitle}>Decrypting Demat Holdings…</Text>
                <Text style={styles.loadingSub}>
                  Fetching stocks across Groww, AngelOne & Zerodha via Setu AA.
                </Text>
              </View>
            )}

            {step === "SUCCESS" && (
              <View style={styles.section}>
                <View style={styles.centerSection}>
                  <Ionicons name="checkmark-circle" size={48} color="#34d399" />
                  <Text style={styles.loadingTitle}>Holdings Synced!</Text>
                  <Text style={styles.loadingSub}>
                    Imported {importedHoldings.length} holdings into your portfolio.
                  </Text>
                </View>

                {importedHoldings.map((h, i) => (
                  <View key={i} style={styles.holdingCard}>
                    <View>
                      <Text style={styles.holdingName}>{h.companyName}</Text>
                      <Text style={styles.holdingSub}>
                        {h.isin} • Qty: {h.quantity}
                      </Text>
                    </View>
                    <View style={styles.rightHolding}>
                      <Text style={styles.holdingValue}>
                        ₹{h.currentValue?.toLocaleString("en-IN")}
                      </Text>
                      <Text style={styles.brokerBadge}>{h.broker}</Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.primaryBtn} onPress={handleReset}>
                  <Text style={styles.btnText}>Done & View Portfolio</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  section: {
    gap: 12,
  },
  centerSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  banner: {
    backgroundColor: "rgba(30, 58, 138, 0.4)",
    borderColor: "rgba(30, 64, 175, 0.5)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  bannerText: {
    color: "#cbd5e1",
    fontSize: 12,
    flex: 1,
  },
  successBanner: {
    backgroundColor: "rgba(6, 78, 59, 0.4)",
    borderColor: "rgba(4, 120, 87, 0.5)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  successBannerText: {
    color: "#6ee7b7",
    fontSize: 13,
    fontWeight: "600",
  },
  label: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    fontFamily: "monospace",
  },
  otpInput: {
    textAlign: "center",
    fontSize: 20,
    color: "#34d399",
    fontWeight: "bold",
  },
  hint: {
    color: "#94a3b8",
    fontSize: 11,
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  approveBtn: {
    backgroundColor: "#059669",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  webBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  webBtnText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "500",
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  loadingSub: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
  },
  holdingCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  holdingName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  holdingSub: {
    color: "#94a3b8",
    fontSize: 10,
    fontFamily: "monospace",
  },
  rightHolding: {
    alignItems: "flex-end",
  },
  holdingValue: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  brokerBadge: {
    color: "#60a5fa",
    fontSize: 9,
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
});
