import React, { useMemo, useState } from "react";
import {
    Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { absoluteUrl, api } from "../api/client";
import type { CustodyRecord, MatchRow, PublicItem } from "../api/types";
import { Banner, Button, Card, EmptyState, Loading, StatusBadge } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, formatDate, formatDateTime, radius, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

const MODERATOR_ROLES = ["security", "admin", "sysadmin", "staff"];

export function ItemDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { user } = useAuth();
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const item = useAsync<PublicItem>(() => api.get<PublicItem>(`/api/items/${itemId}`), [itemId]);

  const moderator = !!user && MODERATOR_ROLES.includes(user.role);

  const custody = useAsync<CustodyRecord[] | null>(async () => {
    try {
      const data = await api.get<{ records: CustodyRecord[] }>(`/api/items/${itemId}/custody`);
      return data.records;
    } catch {
      return null; // not the reporter / not staff - section stays hidden
    }
  }, [itemId, user?.id]);

  const matches = useAsync<MatchRow[] | null>(async () => {
    if (!moderator) return null;
    try {
      const data = await api.get<{ matches: MatchRow[] }>(`/api/items/${itemId}/matches`);
      return data.matches;
    } catch {
      return null;
    }
  }, [itemId, moderator]);

  const images = useMemo(
    () => (item.data?.images ?? []).map((path) => absoluteUrl(path)).filter(Boolean) as string[],
    [item.data],
  );

  async function setMatchStatus(id: string, status: "confirmed" | "dismissed") {
    try {
      await api.patch(`/api/matches/${id}`, { status });
      setBanner({ kind: "success", message: `Match ${status}.` });
      matches.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    }
  }

  if (item.loading) return <Loading label="Loading item…" />;
  if (item.error || !item.data) {
    return (
      <EmptyState title="Item unavailable" subtitle={item.error ?? "Not found."} />
    );
  }

  const data = item.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {banner ? <Banner kind={banner.kind} message={banner.message} /> : null}

      <View style={styles.hero}>
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.image} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.image, styles.imageEmpty]}>
            <Ionicons name="image-outline" size={34} color={colors.muted} />
          </View>
        )}
      </View>

      <View style={styles.headRow}>
        <Text style={styles.type}>{data.type === "lost" ? "LOST REPORT" : "FOUND ITEM"}</Text>
        <StatusBadge label={data.status} />
      </View>
      <Text style={styles.title}>{data.title}</Text>
      <Text style={styles.meta}>
        {data.category.name} · {data.location.path.join(" › ")}
      </Text>

      <Card>
        <DetailRow label="Occurred" value={formatDate(data.occurredAt)} />
        <DetailRow label="Posted" value={formatDate(data.postedAt)} />
        <DetailRow
          label="Verification"
          value={data.hasVerification ? "Owner questions set" : "No questions yet"}
        />
        <DetailRow label="Claimable" value={data.claimable ? "Yes - claims open" : "Not right now"} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{data.description}</Text>
      </Card>

      {Object.keys(data.attributes).length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Details</Text>
          {Object.entries(data.attributes).map(([key, value]) => (
            <DetailRow key={key} label={key} value={value} />
          ))}
        </Card>
      ) : null}

      {data.claimable ? (
        <View style={styles.claimBox}>
          <Text style={styles.claimTitle}>Think this is yours?</Text>
          <Text style={styles.claimText}>
            You will answer secret questions that only the real owner can know.
          </Text>
          <Button
            label="I believe this is mine"
            onPress={() => navigation.navigate("ClaimCreate", { itemId: data.id })}
          />
        </View>
      ) : null}

      {data.type === "lost" && user ? (
        <Card>
          <Text style={styles.sectionTitle}>Found it?</Text>
          <Text style={styles.body}>
            Report the item you found so we can match it with this lost report.
          </Text>
          <View style={styles.inlineButton}>
            <Button
              label="Report a found item"
              variant="secondary"
              onPress={() => navigation.navigate("Tabs")}
            />
          </View>
        </Card>
      ) : null}

      {custody.data && custody.data.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Custody chain</Text>
          {custody.data.map((record) => (
            <View key={record.id} style={styles.custodyRow}>
              <View style={styles.custodySeq}>
                <Text style={styles.custodySeqText}>{record.seq}</Text>
              </View>
              <View style={styles.custodyBody}>
                <Text style={styles.custodyAction}>{record.action.replace(/_/g, " ")}</Text>
                <Text style={styles.custodyMeta}>
                  {record.actorName} · {formatDateTime(record.at)}
                </Text>
                {record.toLocation ? (
                  <Text style={styles.custodyMeta}>→ {record.toLocation}</Text>
                ) : null}
                {record.note ? <Text style={styles.custodyNote}>{record.note}</Text> : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {moderator && matches.data && matches.data.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Suggested matches</Text>
          {matches.data.map((match) => (
            <View key={match.id} style={styles.matchRow}>
              <View style={styles.matchBody}>
                <Text style={styles.matchScore}>{Math.round(match.score * 100)}% match</Text>
                <Text style={styles.matchTitle} numberOfLines={1}>
                  {match.item?.title ?? "Item"}
                </Text>
                <Text style={styles.matchReasons} numberOfLines={2}>
                  {match.reasons.join(" · ")}
                </Text>
                <StatusBadge label={match.status} />
              </View>
              {match.status === "auto" ? (
                <View style={styles.matchActions}>
                  <Pressable onPress={() => void setMatchStatus(match.id, "confirmed")}>
                    <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                  </Pressable>
                  <Pressable onPress={() => void setMatchStatus(match.id, "dismissed")}>
                    <Ionicons name="close-circle" size={26} color={colors.danger} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { marginBottom: spacing.md },
  image: { width: 280, height: 190, borderRadius: radius.lg, backgroundColor: colors.card },
  imageEmpty: { width: "100%", alignItems: "center", justifyContent: "center" },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  type: { fontSize: 12, fontWeight: "800", color: colors.primary, letterSpacing: 0.8 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: spacing.xs },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: spacing.md,
  },
  detailLabel: { fontSize: 14, color: colors.muted, flex: 1 },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: "600", flex: 2, textAlign: "right" },
  claimBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  claimTitle: { fontSize: 16, fontWeight: "700", color: colors.primary },
  claimText: { fontSize: 14, color: colors.primary, marginBottom: spacing.xs },
  inlineButton: { marginTop: spacing.sm },
  custodyRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
  custodySeq: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  custodySeqText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  custodyBody: { flex: 1, gap: 1 },
  custodyAction: { fontSize: 14, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  custodyMeta: { fontSize: 13, color: colors.muted },
  custodyNote: { fontSize: 13, color: colors.text, fontStyle: "italic" },
  matchRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  matchBody: { flex: 1, gap: 2 },
  matchScore: { fontSize: 13, fontWeight: "800", color: colors.success },
  matchTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  matchReasons: { fontSize: 13, color: colors.muted },
  matchActions: { justifyContent: "center", gap: spacing.sm },
});
