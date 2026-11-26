import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import type { NotificationRow, NotificationsPage } from "../api/types";
import { Banner, Button, EmptyState, Loading } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { colors, formatDateTime, radius, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

export function NotificationsScreen({ navigation }: Props) {
  const list = useAsync<NotificationsPage>(
    () => api.get<NotificationsPage>("/api/notifications"),
    [],
  );

  async function markAllRead() {
    await api.post("/api/notifications", {});
    list.reload();
  }

  function open(row: NotificationRow) {
    if (!row.link) return;
    const claimMatch = /^\/claims\/(.+)$/.exec(row.link);
    const itemMatch = /^\/items\/(.+)$/.exec(row.link);
    if (claimMatch) navigation.navigate("ClaimDetail", { claimId: claimMatch[1] });
    else if (itemMatch) navigation.navigate("ItemDetail", { itemId: itemMatch[1] });
  }

  if (list.loading) return <Loading label="Loading notifications…" />;

  const rows = list.data?.notifications ?? [];

  return (
    <View style={styles.container}>
      {list.error ? (
        <View style={styles.bannerWrap}>
          <Banner kind="error" message={list.error} />
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {(list.data?.unreadCount ?? 0)} unread of {rows.length}
        </Text>
        <Button label="Mark all read" variant="secondary" onPress={markAllRead} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState title="No notifications" subtitle="Claim updates and alerts land here." />
        }
        renderItem={({ item }) => (
          <Pressable style={[styles.card, !item.read && styles.cardUnread]} onPress={() => open(item)}>
            <View style={styles.cardHead}>
              <Ionicons
                name={iconFor(item.type)}
                size={18}
                color={item.read ? colors.muted : colors.primary}
              />
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {!item.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.body} numberOfLines={3}>
              {item.body}
            </Text>
            <Text style={styles.time}>{formatDateTime(item.at)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type.startsWith("handover")) return "swap-horizontal";
  if (type.startsWith("claim")) return "document-text";
  if (type.startsWith("verification")) return "shield-checkmark";
  if (type.startsWith("ageing") || type.startsWith("disposal")) return "time";
  return "notifications";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bannerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  count: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { fontSize: 14, color: colors.text, marginTop: spacing.xs, lineHeight: 19 },
  time: { fontSize: 12, color: colors.muted, marginTop: spacing.xs },
});
