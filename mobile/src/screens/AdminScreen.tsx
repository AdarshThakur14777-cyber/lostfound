import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import type { AdminReports, Settings, Taxonomy, UserRow } from "../api/types";
import { PickerField } from "../components/PickerField";
import { Banner, Button, Card, Field, Loading } from "../components/ui";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, radius, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Admin">,
  NativeStackScreenProps<RootStackParamList>
>;

const SETTINGS_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: "retentionDays", label: "Retention days" },
  { key: "ageingWarningDays", label: "Ageing warning (days)" },
  { key: "challengeCount", label: "Questions per challenge" },
  { key: "requiredCorrect", label: "Correct answers required" },
  { key: "maxClaimAttempts", label: "Max claim attempts" },
  { key: "matchThreshold", label: "Match threshold (0-1)" },
  { key: "matchTopK", label: "Match suggestions (top K)" },
  { key: "timeHalfLifeDays", label: "Time half-life (days)" },
];

export function AdminScreen(_: Props) {
  const reports = useAsync<AdminReports>(() => api.get<AdminReports>("/api/admin/reports"), []);
  const settings = useAsync<{ settings: Settings }>(
    () => api.get<{ settings: Settings }>("/api/admin/settings"),
    [],
  );
  const users = useAsync<UserRow[]>(async () => {
    const data = await api.get<{ users: UserRow[] }>("/api/admin/users");
    return data.users;
  }, []);
  const taxonomy = useAsync<Taxonomy>(() => api.get<Taxonomy>("/api/taxonomy"), []);

  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "student" });
  const [newCategory, setNewCategory] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const settingsValues = useMemo(() => {
    const base: Record<string, string> = {};
    if (settings.data) {
      for (const field of SETTINGS_FIELDS) base[field.key] = String(settings.data.settings[field.key]);
    }
    return { ...base, ...form };
  }, [settings.data, form]);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setBanner(null);
    try {
      await action();
      setBanner({ kind: "success", message });
      reports.reload();
      settings.reload();
      users.reload();
      taxonomy.reload();
    } catch (error) {
      setBanner({ kind: "error", message: error instanceof Error ? error.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  function changeSetting(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    await run(async () => {
      const patch: Record<string, number> = {};
      for (const field of SETTINGS_FIELDS) {
        const raw = form[field.key];
        if (raw === undefined) continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error(`${field.label} must be a number`);
        patch[field.key] = value;
      }
      await api.patch("/api/admin/settings", patch);
      setForm({});
    }, "Settings saved.");
  }

  if (reports.loading || settings.loading) return <Loading label="Loading dashboard…" />;

  const stats = reports.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Administration</Text>
      {banner ? <Banner kind={banner.kind} message={banner.message} /> : null}
      {reports.error ? <Banner kind="error" message={reports.error} /> : null}

      {stats ? (
        <>
          <Text style={styles.sectionTitle}>Analytics</Text>
          <View style={styles.grid}>
            <Stat label="Reported" value={stats.totals.reported} />
            <Stat label="Lost" value={stats.totals.lost} />
            <Stat label="Found" value={stats.totals.found} />
            <Stat label="Returned" value={stats.totals.returned} />
            <Stat label="Return rate" value={`${Math.round(stats.returnRate * 100)}%`} />
            <Stat label="Median hours" value={stats.medianHoursToReturn.toFixed(1)} />
            <Stat label="In custody" value={stats.totals.inCustody} />
            <Stat label="Queued" value={stats.totals.disposalPending} />
            <Stat label="Verification fail" value={`${Math.round(stats.verification.failureRate * 100)}%`} />
            <Stat label="Pending matches" value={stats.pendingMatches} />
            <Stat label="Custody records" value={stats.custodyChainLength} />
            <Stat label="Disposals" value={stats.disposals.recorded} />
          </View>

          <Card>
            <Text style={styles.subTitle}>Hotspots</Text>
            {stats.hotspots.slice(0, 5).map((row) => (
              <View key={row.name} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {row.name}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(100, (row.count / Math.max(1, stats.hotspots[0]?.count ?? 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barCount}>{row.count}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Settings</Text>
      <Card>
        {SETTINGS_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            value={settingsValues[field.key] ?? ""}
            onChangeText={(value) => changeSetting(field.key, value)}
            keyboardType="decimal-pad"
          />
        ))}
        <Button label={busy ? "Saving…" : "Save settings"} onPress={saveSettings} loading={busy} />
      </Card>

      <Text style={styles.sectionTitle}>Users</Text>
      <Card>
        {(users.data ?? []).map((row) => (
          <View key={row.id} style={styles.userRow}>
            <View style={styles.flex}>
              <Text style={styles.userName}>{row.name}</Text>
              <Text style={styles.userMeta}>
                {row.email} · {row.role}
              </Text>
            </View>
            <Pressable
              style={styles.roleButton}
              onPress={() =>
                void run(async () => {
                  const nextRole =
                    row.role === "student" ? "staff" : row.role === "staff" ? "security" : "student";
                  await api.patch(`/api/admin/users/${row.id}`, { role: nextRole });
                }, `Role updated for ${row.name}.`)
              }
            >
              <Text style={styles.roleButtonText}>Cycle role</Text>
            </Pressable>
            <Pressable
              style={styles.roleButton}
              onPress={() =>
                void run(async () => {
                  await api.patch(`/api/admin/users/${row.id}`, { active: false });
                }, `${row.name} deactivated.`)
              }
            >
              <Text style={[styles.roleButtonText, styles.dangerText]}>Disable</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.createUser}>
          <Field
            label="New user name"
            value={newUser.name}
            onChangeText={(value) => setNewUser((prev) => ({ ...prev, name: value }))}
            placeholder="Full name"
          />
          <Field
            label="Email"
            autoCapitalize="none"
            value={newUser.email}
            onChangeText={(value) => setNewUser((prev) => ({ ...prev, email: value }))}
            placeholder="name@campus.edu"
          />
          <Field
            label="Password"
            secureTextEntry
            value={newUser.password}
            onChangeText={(value) => setNewUser((prev) => ({ ...prev, password: value }))}
            placeholder="At least 8 characters"
          />
          <PickerField
            label="Role"
            placeholder="Role"
            value={newUser.role}
            onChange={(value) => setNewUser((prev) => ({ ...prev, role: value ?? "student" }))}
            options={[
              { id: "student", label: "Student" },
              { id: "staff", label: "Staff" },
              { id: "security", label: "Security" },
              { id: "admin", label: "Admin" },
              { id: "sysadmin", label: "System admin" },
            ]}
          />
          <Button
            label="Create user"
            variant="secondary"
            loading={busy}
            onPress={() =>
              void run(async () => {
                await api.post("/api/admin/users", {
                  name: newUser.name.trim(),
                  email: newUser.email.trim(),
                  password: newUser.password,
                  role: newUser.role,
                });
                setNewUser({ name: "", email: "", password: "", role: "student" });
              }, "User created.")
            }
          />
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Taxonomy</Text>
      <Card>
        <Text style={styles.subTitle}>Add category</Text>
        <Field
          label="Category name"
          value={newCategory}
          onChangeText={setNewCategory}
          placeholder="e.g. Lab equipment"
        />
        <Button
          label="Add category"
          variant="secondary"
          loading={busy}
          onPress={() =>
            void run(async () => {
              await api.post("/api/admin/categories", { name: newCategory.trim() });
              setNewCategory("");
            }, "Category added.")
          }
        />

        <Text style={[styles.subTitle, styles.spaced]}>Add location</Text>
        <Field
          label="Location name"
          value={newLocation}
          onChangeText={setNewLocation}
          placeholder="e.g. Engineering Block"
        />
        <Button
          label="Add location"
          variant="secondary"
          loading={busy}
          onPress={() =>
            void run(async () => {
              await api.post("/api/admin/locations", { name: newLocation.trim() });
              setNewLocation("");
            }, "Location added.")
          }
        />

        <Text style={[styles.subTitle, styles.spaced]}>
          Categories ({taxonomy.data?.categories.length ?? 0})
        </Text>
        {(taxonomy.data?.categories ?? []).map((row) => (
          <View key={row.id} style={styles.taxRow}>
            <Text style={styles.taxLabel} numberOfLines={1}>
              {row.name}
              {row.attributes.length > 0 ? ` · ${row.attributes.join(", ")}` : ""}
            </Text>
            <Pressable
              onPress={() =>
                void run(async () => {
                  await api.del(`/api/admin/categories/${row.id}`);
                }, "Category deleted.")
              }
            >
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
          </View>
        ))}

        <Text style={[styles.subTitle, styles.spaced]}>
          Locations ({taxonomy.data?.locations.length ?? 0})
        </Text>
        {(taxonomy.data?.locations ?? []).map((row) => (
          <View key={row.id} style={styles.taxRow}>
            <Text style={styles.taxLabel} numberOfLines={1}>
              {row.path.length > 1 ? row.path.join(" › ") : row.name}
            </Text>
            <Pressable
              onPress={() =>
                void run(async () => {
                  await api.del(`/api/admin/locations/${row.id}`);
                }, "Location deleted.")
              }
            >
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  flex: { flex: 1 },
  heading: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  spaced: { marginTop: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    width: "31%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.primary },
  statLabel: { fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 2 },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  barLabel: { width: 110, fontSize: 13, color: colors.text },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EDEFF3",
    overflow: "hidden",
  },
  barFill: { height: 8, backgroundColor: colors.primary },
  barCount: { width: 28, textAlign: "right", fontSize: 13, fontWeight: "700", color: colors.text },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userName: { fontSize: 15, fontWeight: "700", color: colors.text },
  userMeta: { fontSize: 12, color: colors.muted },
  roleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  roleButtonText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  dangerText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  createUser: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  taxLabel: { flex: 1, fontSize: 14, color: colors.text },
});
