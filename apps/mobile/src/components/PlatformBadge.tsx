import React from "react";
import { TouchableOpacity, Text, StyleSheet, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getBrokerConfig } from "@/lib/broker-config";

interface PlatformBadgeProps {
  providerCode?: string | null;
  symbol?: string;
}

export function PlatformBadge({ providerCode, symbol }: PlatformBadgeProps) {
  const cfg = getBrokerConfig(providerCode);
  const isClickable = Boolean(symbol && cfg.deepLink(symbol) !== "#");
  const url = symbol ? cfg.deepLink(symbol) : cfg.webUrl;

  const handlePress = async () => {
    if (!isClickable) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(cfg.webUrl);
      }
    } catch {
      Alert.alert("Unable to open link", `Could not open ${cfg.label}.`);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!isClickable}
      activeOpacity={0.7}
      style={[styles.badge, { backgroundColor: cfg.bgColor, borderColor: cfg.textColor + "40" }]}
    >
      <Text style={styles.emoji}>{cfg.emoji}</Text>
      <Text style={[styles.label, { color: cfg.textColor }]}>{cfg.shortLabel}</Text>
      {isClickable && (
        <Ionicons name="open-outline" size={10} color={cfg.textColor} style={styles.icon} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  emoji: {
    fontSize: 10,
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
  icon: {
    marginLeft: 3,
    opacity: 0.8,
  },
});
