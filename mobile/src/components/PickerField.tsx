import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme";

export interface PickOption {
  id: string;
  label: string;
  sublabel?: string;
}

/** Row that opens a searchable modal list - used for categories and locations. */
export function PickerField({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: PickOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        (option.sublabel ?? "").toLowerCase().includes(needle),
    );
  }, [options, query]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.row} onPress={() => setOpen(true)}>
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            autoFocus
            placeholder="Search"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              value ? (
                <Pressable
                  style={styles.clear}
                  onPress={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.clearText}>Clear selection</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, item.id === value && styles.optionActive]}
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionLabel}>{item.label}</Text>
                {item.sublabel ? <Text style={styles.optionSub}>{item.sublabel}</Text> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  value: { fontSize: 16, color: colors.text, flex: 1 },
  placeholder: { color: colors.muted },
  modal: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.xl },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primarySoft },
  optionLabel: { fontSize: 16, color: colors.text },
  optionSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  clear: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  clearText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
});
