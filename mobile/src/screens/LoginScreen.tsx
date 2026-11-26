import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../state/AuthContext";
import { Banner, Button, Field } from "../components/ui";
import { colors, spacing } from "../theme";

export function LoginScreen({ navigation }: { navigation: { navigate: (screen: "Register") => void } }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.logo}>Campus Lost &amp; Found</Text>
          <Text style={styles.tagline}>Report. Verify. Reunite.</Text>
        </View>

        {error ? <Banner kind="error" message={error} /> : null}

        <Field
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@campus.edu"
        />
        <Field
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />

        <Button label={busy ? "Signing in…" : "Sign in"} onPress={submit} loading={busy} />

        <View style={styles.footer}>
          <Text style={styles.muted}>New here? </Text>
          <Pressable onPress={() => navigation.navigate("Register")}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo accounts (password Demo1234!)</Text>
          <Text style={styles.demoLine}>student@demo.local · staff@demo.local</Text>
          <Text style={styles.demoLine}>security@demo.local · admin@demo.local</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: spacing.xl * 2, gap: spacing.sm },
  hero: { marginBottom: spacing.lg },
  logo: { fontSize: 28, fontWeight: "800", color: colors.text },
  tagline: { fontSize: 15, color: colors.muted, marginTop: spacing.xs },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  muted: { color: colors.muted, fontSize: 15 },
  link: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  demoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    gap: 2,
  },
  demoTitle: { fontSize: 12, fontWeight: "700", color: colors.primary },
  demoLine: { fontSize: 12, color: colors.primary },
});
