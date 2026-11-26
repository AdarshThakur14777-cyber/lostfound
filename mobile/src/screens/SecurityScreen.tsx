import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import type { AdminQueue, DisposalMethod, HandoverRow } from "../api/types";
import { Banner, Button, Card, Loading, StatusBadge } from "../components/ui";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, formatDate, formatDateTime, radius, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Staff">,
  NativeStackScreenProps<RootStackParamList>
>;

const DISPOSALS: { id: DisposalMethod; label: string }[] = [
  { id: "discarded", label: "Discard" },
  { id: "donated", label: "Donate" },
  { id: "returned_to_originator", label: "Return to sender" },
  { id: "archive", label: "Archive" },
];

export function SecurityScreen({ navigation }: Props) {
  const queue = useAsync<AdminQueue>(() => api.get<AdminQueue>("/api/admin/queue"), []);
  const handovers = useAsync<HandoverRow[]>(async () => {
    const data = await api.get<{ handovers: HandoverRow[] }>("/api/handovers", {
      status: "scheduled",
    });
    return data.handovers;
  }, []);

  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [disposalTarget, setDisposalTarget] = useState<string | null>(null);

  async function runAgeing() {
    setBusy(true);
    try {
      const result = await api.post<{ warnings: number; queued: number; disposed: number }>(
        "/api/admin/ageing",
      );
      setBanner({
        kind: "success",
        message: `Ageing sweep done: ${result.warnings} warning(s), ${result.queued} queued, ${result.disposed} disposed.`,
      });
      queue.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function refreshMatches() {
    setBusy(true);
    try {
      const result = await api.post<{ checked: number; suggestions: number }>(
        "/api/admin/matches/refresh",
      );
      setBanner({
        kind: "success",
        message: `Matches refreshed: ${result.suggestions} suggestion(s) from ${result.checked} item(s).`,
      });
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function dispose(id: string, method: DisposalMethod) {
    setBusy(true);
    try {
      await api.post(`/api/admin/items/${id}/dispose`, { method });
      setBanner({ kind: "success", message: "Item disposed and recorded." });
      setDisposalTarget(null);
      queue.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  if (queue.loading) return <Loading label="Loading queue…" />;

  const data = queue.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Operations</Text>
      {banner ? <Banner kind={banner.kind} message={banner.message} /> : null}
      {queue.error ? <Banner kind="error" message={queue.error} /> : null}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Run ageing sweep" onPress={runAgeing} loading={busy} variant="secondary" />
        </View>
        <View style={styles.flex}>
          <Button label="Refresh matches" onPress={refreshMatches} loading={busy} variant="secondary" />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Verification queue</Text>
      {data && data.verificationQueue.length > 0 ? (
        data.verificationQueue.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => navigation.navigate("ClaimDetail", { claimId: row.id })}
          >
            <Card style={styles.tight}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.itemTitle}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {row.claimantName} · {formatDateTime(row.createdAt)} · {row.attempts} attempt(s)
                  </Text>
                </View>
                <StatusBadge label={row.status} />
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        <Card>
          <Text style={styles.empty}>Nothing waiting for review.</Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Scheduled handovers</Text>
      {handovers.loading ? (
        <Loading />
      ) : (handovers.data ?? []).length === 0 ? (
        <Card>
          <Text style={styles.empty}>No handovers scheduled.</Text>
        </Card>
      ) : (
        (handovers.data ?? []).map((row) => (
          <Pressable
            key={row.id}
            onPress={() => navigation.navigate("ClaimDetail", { claimId: row.claimId })}
          >
            <Card style={styles.tight}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.itemTitle}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {row.claimantName} ({row.method}) · {formatDateTime(row.createdAt)}
                  </Text>
                </View>
                <StatusBadge label={row.status} />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>Ageing warnings</Text>
      {data && data.ageing.length > 0 ? (
        data.ageing.map((row) => (
          <Pressable key={row.id} onPress={() => navigation.navigate("ItemDetail", { itemId: row.id })}>
            <Card style={styles.tight}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {row.category} · {row.location} · {row.ageDays}d old
                  </Text>
                </View>
                <Text style={[styles.days, row.due && styles.daysDue]}>
                  {row.remainingDays <= 0 ? "due" : `${row.remainingDays}d left`}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        <Card>
          <Text style={styles.empty}>No items nearing disposal.</Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Disposal queue</Text>
      {data && data.disposalQueue.length > 0 ? (
        data.disposalQueue.map((row) => (
          <Card key={row.id} style={styles.tight}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {row.category} · {row.ageDays}d old · queued {formatDate(row.queuedAt)}
                </Text>
              </View>
              <Pressable
                style={styles.disposeButton}
                onPress={() => setDisposalTarget(disposalTarget === row.id ? null : row.id)}
              >
                <Text style={styles.disposeText}>Dispose</Text>
              </Pressable>
            </View>
            {disposalTarget === row.id ? (
              <View style={styles.disposalMethods}>
                {DISPOSALS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={styles.disposalChip}
                    onPress={() => void dispose(row.id, option.id)}
                    disabled={busy}
                  >
                    <Text style={styles.disposalChipText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.empty}>Nothing queued for disposal.</Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Custody inventory</Text>
      <Card>
        {data && data.custodyInventory.length > 0 ? (
          data.custodyInventory.map((row) => (
            <View key={row.locationId} style={styles.inventoryRow}>
              <Text style={styles.inventoryName}>{row.name}</Text>
              <Text style={styles.inventoryCount}>{row.count}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No items in custody.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  flex: { flex: 1 },
  heading: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tight: { padding: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  days: { fontSize: 13, fontWeight: "800", color: colors.warn },
  daysDue: { color: colors.danger },
  empty: { fontSize: 14, color: colors.muted },
  disposeButton: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  disposeText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  disposalMethods: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  disposalChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg,
  },
  disposalChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  inventoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inventoryName: { fontSize: 14, color: colors.text },
  inventoryCount: { fontSize: 14, fontWeight: "800", color: colors.primary },
});
