import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PublicItem, PublicListItem } from "../api/types";
import { absoluteUrl } from "../api/client";
import { colors, formatDate, radius, spacing } from "../theme";
import { StatusBadge } from "./ui";

export function ItemCard({
  item,
  onPress,
  subtitle,
  meta,
}: {
  item: PublicListItem | PublicItem;
  onPress: () => void;
  subtitle?: string;
  meta?: string;
}) {
  const image = absoluteUrl(item.images[0] ?? null);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons
            name={item.type === "lost" ? "search" : "pricetag"}
            size={22}
            color={colors.muted}
          />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.type}>{item.type === "lost" ? "LOST" : "FOUND"}</Text>
          <StatusBadge label={item.status} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {subtitle ?? `${item.category.name} · ${item.location.name}`}
        </Text>
        <Text style={styles.date}>{meta ?? formatDate(item.postedAt ?? item.occurredAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  image: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.bg },
  placeholder: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 3 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  type: { fontSize: 11, fontWeight: "800", color: colors.primary, letterSpacing: 0.6 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  date: { fontSize: 12, color: colors.muted },
});
