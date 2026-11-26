import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import type { CreateClaimResponse, PublicItem } from "../api/types";
import { Banner, Button, Card, Field, Loading, StatusBadge } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { colors, formatDate, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "ClaimCreate">;

export function ClaimCreateScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const item = useAsync<PublicItem>(() => api.get<PublicItem>(`/api/items/${itemId}`), [itemId]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (note.trim().length < 5) {
      setError("Tell the reviewer why this item is yours (at least 5 characters).");
      return;
    }
    setBusy(true);
    try {
      const result = await api.post<CreateClaimResponse>("/api/claims", {
        itemId,
        note: note.trim(),
      });
      navigation.replace("ClaimDetail", { claimId: result.claim.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the claim");
    } finally {
      setBusy(false);
    }
  }

  if (item.loading) return <Loading />;
  if (item.error || !item.data) {
    return <Text style={styles.error}>{item.error ?? "Item not found."}</Text>;
  }

  const data = item.data;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
          <StatusBadge label={data.status} />
        </View>
        <Text style={styles.meta}>
          {data.category.name} · {data.location.path.join(" › ")} · {formatDate(data.occurredAt)}
        </Text>
        <Text style={styles.body} numberOfLines={4}>
          {data.description}
        </Text>
        <Text style={styles.note}>
          {data.hasVerification
            ? "This item has secret owner questions - you will answer them next."
            : "This item has no secret questions; staff will review your claim manually."}
        </Text>
      </Card>

      {error ? <Banner kind="error" message={error} /> : null}

      <Field
        label="Why is this item yours?"
        value={note}
        onChangeText={setNote}
        placeholder="Describe marks, contents, or anything only the owner would know"
        multiline
        numberOfLines={5}
        style={styles.textarea}
        maxLength={1000}
      />

      <Button label={busy ? "Submitting…" : "Submit claim"} onPress={submit} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 },
  meta: { fontSize: 13, color: colors.muted, marginTop: spacing.xs },
  body: { fontSize: 14, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  note: { fontSize: 13, color: colors.primary, marginTop: spacing.sm, fontWeight: "600" },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  error: { padding: spacing.lg, color: colors.danger },
});
