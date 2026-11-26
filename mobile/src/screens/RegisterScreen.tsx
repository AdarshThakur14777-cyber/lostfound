import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useAuth } from "../state/AuthContext";
import { Banner, Button, Field } from "../components/ui";
import { PickerField } from "../components/PickerField";
import { colors, spacing } from "../theme";

export function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string | null>("student");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (name.trim().length < 2) setError("Enter your full name.");
    else if (!email.includes("@")) setError("Enter a valid email address.");
    else if (password.length < 8) setError("Password must be at least 8 characters.");
    else {
      setBusy(true);
      try {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role: role === "staff" ? "staff" : "student",
          department: department.trim() || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      } finally {
        setBusy(false);
      }
      return;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {error ? <Banner kind="error" message={error} /> : null}

        <Field label="Full name" value={name} onChangeText={setName} placeholder="Asha Nair" />
        <Field
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="asha@campus.edu"
        />
        <Field
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          hint="At least 8 characters."
        />
        <PickerField
          label="Account type"
          placeholder="Choose"
          value={role}
          onChange={setRole}
          options={[
            { id: "student", label: "Student" },
            { id: "staff", label: "Staff member" },
          ]}
        />
        <Field
          label="Department (optional)"
          value={department}
          onChangeText={setDepartment}
          placeholder="Physics"
        />

        <View style={styles.actions}>
          <Button label={busy ? "Creating…" : "Create account"} onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.sm },
  actions: { marginTop: spacing.md },
});
