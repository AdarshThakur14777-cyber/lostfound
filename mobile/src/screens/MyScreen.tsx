import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, getBaseUrl, setBaseUrl } from "../api/client";
import type { ClaimView, NotificationsPage, PublicItem } from "../api/types";
import { ItemCard } from "../components/ItemCard";
import { Banner, Button, Card, Field, Loading, StatusBadge } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, formatDateTime, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Me">,
  NativeStackScreenProps<RootStackParamList>
>;

interface MyItemRow extends PublicItem {
  claimCount: number;
}

export function MyScreen({ navigation }: Props) {
  const { user, logout, refresh } = useAuth();
  const claims = useAsync<ClaimView[]>(async () => {
    const data = await api.get<{ claims: ClaimView[] }>("/api/claims");
    return data.claims;
  }, []);
  const mine = useAsync<MyItemRow[]>(async () => {
    const data = await api.get<{ items: MyItemRow[] }>("/api/items", { scope: "mine" });
    return data.items;
  }, []);
  const notifications = useAsync<NotificationsPage>(
    () => api.get<NotificationsPage>("/api/notifications", { unread: 1 }),
    [],
  );
  const moderator = !!user && ["staff", "security", "admin", "sysadmin"].includes(user.role);

  const [server, setServer] = useState(getBaseUrl());
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveServer() {
    setBusy(true);
    try {
      await setBaseUrl(server);
      setBanner({ kind: "success", message: "Server URL saved." });
      await refresh();
      claims.reload();
      mine.reload();
    } finally {
      setBusy(false);
    }
  }

  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name ?? "?").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.badgeRow}>
              <StatusBadge label={user?.role ?? ""} />
              {user?.department ? <Text style={styles.department}>{user.department}</Text> : null}
            </View>
          </View>
        </View>
      </Card>

      {banner ? <Banner kind={banner.kind} message={banner.message} /> : null}

      <Pressable style={styles.rowLink} onPress={() => navigation.navigate("Notifications")}>
        <View style={styles.rowLinkLeft}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          <Text style={styles.rowLinkText}>Notifications</Text>
        </View>
        {unread > 0 ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{unread}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>My claims</Text>
      {claims.loading ? (
        <Loading />
      ) : claims.error ? (
        <Banner kind="error" message={claims.error} />
      ) : (claims.data ?? []).length === 0 ? (
        <Card>
          <Text style={styles.empty}>No claims yet. Open a claim from any found item.</Text>
        </Card>
      ) : (
        (claims.data ?? []).map((claim) => (
          <Pressable
            key={claim.id}
            onPress={() => navigation.navigate("ClaimDetail", { claimId: claim.id })}
          >
            <Card style={styles.tight}>
              <View style={styles.claimRow}>
                <View style={styles.flex}>
                  <Text style={styles.claimTitle} numberOfLines={1}>
                    {claim.item?.title ?? "Item"}
                  </Text>
                  <Text style={styles.claimMeta}>{formatDateTime(claim.createdAt)}</Text>
                </View>
                <StatusBadge label={claim.status} />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>My reports</Text>
      {mine.loading ? (
        <Loading />
      ) : mine.error ? (
        <Banner kind="error" message={mine.error} />
      ) : (mine.data ?? []).length === 0 ? (
        <Card>
          <Text style={styles.empty}>You have not posted anything yet.</Text>
        </Card>
      ) : (
        (mine.data ?? []).map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onPress={() => navigation.navigate("ItemDetail", { itemId: item.id })}
            meta={
              moderator
                ? `${item.claimCount} claim(s) · ${formatDateTime(item.postedAt)}`
                : undefined
            }
          />
        ))
      )}

      <Text style={styles.sectionTitle}>Server</Text>
      <Card>
        <Field
          label="API base URL"
          value={server}
          onChangeText={setServer}
          autoCapitalize="none"
          autoComplete="off"
          placeholder="http://10.0.2.2:3000"
          hint="Android emulator: http://10.0.2.2:3000 · Device on same Wi-Fi: use your PC's IP."
        />
        <Button label="Save & reconnect" variant="secondary" onPress={saveServer} loading={busy} />
      </Card>

      <Button label="Sign out" variant="danger" onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  flex: { flex: 1 },
  profileRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  email: { fontSize: 13, color: colors.muted },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  department: { fontSize: 12, color: colors.muted },
  rowLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  rowLinkLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowLinkText: { fontSize: 15, fontWeight: "600", color: colors.text },
  pill: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tight: { padding: spacing.md },
  claimRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  claimTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  claimMeta: { fontSize: 12, color: colors.muted },
  empty: { fontSize: 14, color: colors.muted },
});
