import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getBaseUrl, uploadImage } from "../api/client";
import { colors, radius, spacing } from "../theme";

/** Picks photos, uploads them immediately and keeps the returned paths. */
export function PhotoStrip({
  paths,
  onChange,
  label = "Photos",
  max = 4,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  label?: string;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);

  async function pick() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo access to attach images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, max - paths.length),
        quality: 0.7,
      });
      if (result.canceled || result.assets.length === 0) return;

      setBusy(true);
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        if (paths.length + uploaded.length >= max) break;
        uploaded.push(await uploadImage(asset.uri));
      }
      onChange([...paths, ...uploaded]);
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.strip}>
        {paths.map((path) => (
          <View key={path} style={styles.thumbWrap}>
            <Image source={{ uri: resolve(path) }} style={styles.thumb} />
            <Pressable
              style={styles.remove}
              onPress={() => onChange(paths.filter((entry) => entry !== path))}
            >
              <Ionicons name="close" size={14} color="#FFF" />
            </Pressable>
          </View>
        ))}
        {paths.length < max ? (
          <Pressable style={[styles.thumb, styles.add]} onPress={pick} disabled={busy}>
            <Ionicons name={busy ? "hourglass" : "camera"} size={22} color={colors.primary} />
            <Text style={styles.addText}>{busy ? "Uploading" : "Add"}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Photos are stripped of EXIF/GPS before they are stored.</Text>
    </View>
  );
}

function resolve(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${getBaseUrl()}${path}`;
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: spacing.xs },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: 999,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  add: { borderStyle: "dashed", gap: 2 },
  addText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.muted, marginTop: spacing.xs },
});
