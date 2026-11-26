import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import type {
  ClaimView,
  ScheduleHandoverResponse,
  VerifyOutcome,
} from "../api/types";
import { ItemCard } from "../components/ItemCard";
import { PhotoStrip } from "../components/PhotoStrip";
import { Banner, Button, Card, Field, Loading, StatusBadge } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, formatDateTime, radius, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "ClaimDetail">;

const DECISION_ROLES = ["security", "admin", "sysadmin"];

export function ClaimDetailScreen({ route, navigation }: Props) {
  const { claimId } = route.params;
  const { user } = useAuth();
  const claim = useAsync<ClaimView>(() => api.get<ClaimView>(`/api/claims/${claimId}`), [claimId]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<"otp" | "signature">("otp");
  const [handover, setHandover] = useState<ScheduleHandoverResponse | null>(null);
  const [otp, setOtp] = useState("");
  const [signature, setSignature] = useState("");
  const [proof, setProof] = useState<string[]>([]);

  const moderator = !!user && DECISION_ROLES.includes(user.role);
  const data = claim.data;

  const canVerify = useMemo(
    () => !!data && !!data.questions && data.questions.length > 0 && data.attemptsLeft > 0,
    [data],
  );

  async function submitAnswers() {
    if (!data?.questions) return;
    setBusy(true);
    setBanner(null);
    try {
      const result = await api.post<VerifyOutcome>(`/api/claims/${claimId}/verify`, {
        answers: data.questions.map((question) => ({
          entryId: question.entryId,
          answer: (answers[question.entryId] ?? "").trim(),
        })),
      });
      setOutcome(result);
      setBanner({
        kind: result.passed ? "success" : "error",
        message: result.passed
          ? "Verification passed - security will review your claim."
          : `Not quite: ${result.correctCount}/${result.requiredCorrect} correct, ${result.attemptsLeft} attempts left.`,
      });
      claim.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setBanner(null);
    try {
      await api.post(`/api/claims/${claimId}/decision`, {
        decision,
        note: decisionNote.trim() || undefined,
      });
      setBanner({
        kind: "success",
        message: decision === "approve" ? "Claim approved." : "Claim rejected.",
      });
      claim.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function scheduleHandover() {
    setBusy(true);
    setBanner(null);
    try {
      const result = await api.post<ScheduleHandoverResponse>("/api/handovers", {
        claimId,
        method,
      });
      setHandover(result);
      setBanner({
        kind: "success",
        message:
          method === "otp"
            ? "Handover scheduled. The claimant received a one-time code in their notifications - ask them to read it out."
            : "Handover scheduled. The claimant will sign at the desk.",
      });
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function completeHandover() {
    if (!handover) return;
    if (proof.length === 0) {
      setBanner({ kind: "error", message: "A proof photo of the handover is required." });
      return;
    }
    if (handover.method === "otp" && otp.trim().length < 4) {
      setBanner({ kind: "error", message: "Enter the OTP the claimant read out." });
      return;
    }
    if (handover.method === "signature" && signature.trim().length < 2) {
      setBanner({ kind: "error", message: "Enter the claimant's printed name." });
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      await api.post(`/api/handovers/${handover.id}/complete`, {
        otp: handover.method === "otp" ? otp.trim() : undefined,
        signatureName: handover.method === "signature" ? signature.trim() : undefined,
        proofImage: proof[0],
      });
      setBanner({ kind: "success", message: "Handover complete. The custody chain is closed." });
      setHandover(null);
      setOtp("");
      setSignature("");
      setProof([]);
      claim.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  if (claim.loading) return <Loading label="Loading claim…" />;
  if (claim.error || !data) {
    return <Text style={styles.error}>{claim.error ?? "Claim not found."}</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headRow}>
        <Text style={styles.heading}>Claim</Text>
        <StatusBadge label={data.status} />
      </View>
      <Text style={styles.sub}>By {data.claimantName} · {formatDateTime(data.createdAt)}</Text>

      {banner ? <Banner kind={banner.kind} message={banner.message} /> : null}

      {data.item ? (
        <Pressable onPress={() => navigation.navigate("ItemDetail", { itemId: data.itemId })}>
          <ItemCard
            item={data.item}
            onPress={() => navigation.navigate("ItemDetail", { itemId: data.itemId })}
            subtitle={`${data.item.category.name} · ${data.item.location.name}`}
          />
        </Pressable>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Claimant's note</Text>
        <Text style={styles.body}>{data.note}</Text>
        {data.decisionNote ? (
          <View style={styles.decisionBox}>
            <Text style={styles.sectionTitle}>Review note</Text>
            <Text style={styles.body}>{data.decisionNote}</Text>
          </View>
        ) : null}
      </Card>

      {/* Claimant: verification challenge */}
      {canVerify ? (
        <Card>
          <Text style={styles.sectionTitle}>Prove ownership</Text>
          <Text style={styles.sectionNote}>
            Answer {data.requiredCorrect ?? 0}+ questions correctly.{" "}
            {data.attemptsLeft} attempt(s) left.
          </Text>
          {data.questions?.map((question) => (
            <Field
              key={question.entryId}
              label={question.question}
              value={answers[question.entryId] ?? ""}
              onChangeText={(value) =>
                setAnswers((prev) => ({ ...prev, [question.entryId]: value }))
              }
              placeholder="Your answer"
              autoCapitalize="none"
            />
          ))}
          <Button
            label={busy ? "Checking…" : "Submit answers"}
            onPress={submitAnswers}
            loading={busy}
          />
          {outcome ? (
            <View style={styles.outcomeRow}>
              {outcome.results.map((result) => (
                <Ionicons
                  key={result.entryId}
                  name={result.correct ? "checkmark-circle" : "close-circle"}
                  size={22}
                  color={result.correct ? colors.success : colors.danger}
                />
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {data.status === "verification_failed" ? (
        <Banner
          kind="error"
          message="Verification failed - no attempts left. Staff can still review the claim manually."
        />
      ) : null}

      {data.status === "verification_passed" ? (
        <Banner
          kind="info"
          message="Verification passed. A security officer will review and approve your claim."
        />
      ) : null}

      {data.status === "approved" && !moderator ? (
        <Banner
          kind="info"
          message="Approved! Collect your item at the security desk - you will receive a one-time code there."
        />
      ) : null}

      {data.status === "handed_over" ? (
        <Banner kind="success" message="This claim is complete - the item was returned." />
      ) : null}

      {/* Moderator: decision */}
      {moderator && (data.status === "verification_passed" || data.status === "pending") ? (
        <Card>
          <Text style={styles.sectionTitle}>Review claim</Text>
          {data.status === "verification_passed" ? (
            <Text style={styles.okText}>Ownership verification passed.</Text>
          ) : (
            <Text style={styles.sectionNote}>
              Verification has not passed - approval may fail until it does.
            </Text>
          )}
          <Field
            label="Note (optional)"
            value={decisionNote}
            onChangeText={setDecisionNote}
            placeholder="Shown in the audit trail"
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label="Approve"
                onPress={() => void decide("approve")}
                loading={busy}
                disabled={!data.passed}
              />
            </View>
            <View style={styles.flex}>
              <Button label="Reject" variant="danger" onPress={() => void decide("reject")} />
            </View>
          </View>
        </Card>
      ) : null}

      {/* Moderator: supervised handover */}
      {moderator && data.status === "approved" ? (
        <Card>
          <Text style={styles.sectionTitle}>Supervised handover</Text>
          {!handover ? (
            <>
              <Text style={styles.sectionNote}>
                Schedule the handover, then complete it with the claimant's OTP or signature and a
                proof photo.
              </Text>
              <View style={styles.methodRow}>
                {(["otp", "signature"] as const).map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.methodChip, method === value && styles.methodActive]}
                    onPress={() => setMethod(value)}
                  >
                    <Text
                      style={[styles.methodText, method === value && styles.methodTextActive]}
                    >
                      {value === "otp" ? "One-time code" : "Signature"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                label={busy ? "Scheduling…" : "Schedule handover"}
                onPress={scheduleHandover}
                loading={busy}
              />
            </>
          ) : (
            <>
              <Banner kind="info" message={`Handover ${handover.id} is scheduled.`} />
              {handover.method === "otp" ? (
                <Field
                  label="OTP read out by the claimant"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              ) : (
                <Field
                  label="Claimant's printed name"
                  value={signature}
                  onChangeText={setSignature}
                  placeholder="Name signed at the desk"
                />
              )}
              <PhotoStrip paths={proof} onChange={setProof} label="Proof photo (required)" max={1} />
              <Button
                label={busy ? "Completing…" : "Complete handover"}
                onPress={completeHandover}
                loading={busy}
              />
            </>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 24, fontWeight: "800", color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  sectionNote: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm, lineHeight: 18 },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  decisionBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  row: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
  okText: { fontSize: 14, color: colors.success, fontWeight: "700", marginBottom: spacing.sm },
  methodRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  methodChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  methodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  methodTextActive: { color: "#FFFFFF" },
  outcomeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  error: { padding: spacing.lg, color: colors.danger },
});
