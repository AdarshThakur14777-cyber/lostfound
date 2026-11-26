import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import type { PublicItem, Taxonomy } from "../api/types";
import { PickerField } from "../components/PickerField";
import { PhotoStrip } from "../components/PhotoStrip";
import { Banner, Button, Card, Field } from "../components/ui";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Report">,
  NativeStackScreenProps<RootStackParamList>
>;

interface QA {
  question: string;
  answer: string;
}

export function ReportScreen({ navigation }: Props) {
  const taxonomy = useAsync<Taxonomy>(() => api.get<Taxonomy>("/api/taxonomy"), []);

  const [type, setType] = useState<"found" | "lost">("found");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [images, setImages] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<QA[]>([{ question: "", answer: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedCategory = useMemo(
    () => taxonomy.data?.categories.find((entry) => entry.id === categoryId) ?? null,
    [taxonomy.data, categoryId],
  );

  const categoryOptions = (taxonomy.data?.categories ?? []).map((entry) => ({
    id: entry.id,
    label: entry.name,
  }));
  const locationOptions = (taxonomy.data?.locations ?? []).map((entry) => ({
    id: entry.id,
    label: entry.path.length > 1 ? entry.path.join(" › ") : entry.name,
  }));

  function pickCategory(id: string | null) {
    setCategoryId(id);
    const names = taxonomy.data?.categories.find((entry) => entry.id === id)?.attributes ?? [];
    setAttributes(Object.fromEntries(names.map((name) => [name, ""])));
  }

  async function submit() {
    setError(null);
    const trimmedQuestions = questions
      .map((qa) => ({ question: qa.question.trim(), answer: qa.answer.trim() }))
      .filter((qa) => qa.question && qa.answer);

    if (title.trim().length < 3) setError("Give it a short, clear title (3+ characters).");
    else if (description.trim().length < 10) setError("Describe it in at least 10 characters.");
    else if (!categoryId || !locationId) setError("Pick a category and a location.");
    else if (Number.isNaN(new Date(occurredAt).getTime())) setError("Use a valid date (YYYY-MM-DD).");
    else if (type === "found" && trimmedQuestions.length === 0)
      setError("Add at least one secret question - only the owner will know the answer.");
    else {
      setBusy(true);
      try {
        const item = await api.post<PublicItem>("/api/items", {
          type,
          title: title.trim(),
          description: description.trim(),
          categoryId,
          locationId,
          occurredAt: new Date(occurredAt).toISOString(),
          attributes: Object.fromEntries(
            Object.entries(attributes).filter(([, value]) => value.trim()),
          ),
          images,
          privateDetails: trimmedQuestions,
        });
        setTitle("");
        setDescription("");
        setImages([]);
        setQuestions([{ question: "", answer: "" }]);
        navigation.navigate("ItemDetail", { itemId: item.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit the report");
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
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Report an item</Text>

        <View style={styles.segment}>
          {(["found", "lost"] as const).map((value) => (
            <Pressable
              key={value}
              style={[styles.segmentItem, type === value && styles.segmentActive]}
              onPress={() => setType(value)}
            >
              <Text style={[styles.segmentText, type === value && styles.segmentTextActive]}>
                I found something
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.segmentItem, type === "lost" && styles.segmentActive]}
            onPress={() => setType("lost")}
          >
            <Text style={[styles.segmentText, type === "lost" && styles.segmentTextActive]}>
              I lost something
            </Text>
          </Pressable>
        </View>

        {error ? <Banner kind="error" message={error} /> : null}

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder={type === "found" ? "Black wireless earbuds case" : "Lost my student card"}
          maxLength={120}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Where, when, and any details that help identify it"
          multiline
          numberOfLines={4}
          style={styles.textarea}
          maxLength={2000}
        />
        <PickerField
          label="Category"
          placeholder="Choose a category"
          options={categoryOptions}
          value={categoryId}
          onChange={pickCategory}
        />
        <PickerField
          label="Location"
          placeholder="Where was it lost or found?"
          options={locationOptions}
          value={locationId}
          onChange={setLocationId}
        />
        <Field
          label="Date (YYYY-MM-DD)"
          value={occurredAt}
          onChangeText={setOccurredAt}
          placeholder="2026-09-29"
        />

        {selectedCategory && selectedCategory.attributes.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>{selectedCategory.name} details</Text>
            {selectedCategory.attributes.map((name) => (
              <Field
                key={name}
                label={name}
                value={attributes[name] ?? ""}
                onChangeText={(value) => setAttributes((prev) => ({ ...prev, [name]: value }))}
                placeholder={name}
              />
            ))}
          </Card>
        ) : null}

        <PhotoStrip paths={images} onChange={setImages} max={4} />

        <Card>
          <Text style={styles.sectionTitle}>Secret owner questions</Text>
          <Text style={styles.sectionNote}>
            {type === "found"
              ? "Stored encrypted. Only a claimant who knows the answers can verify ownership - staff never see them."
              : "Optional for lost reports: answers you add are encrypted and used to verify a finder's claim."}
          </Text>
          {questions.map((qa, index) => (
            <View key={index} style={styles.qaBlock}>
              <Field
                label={`Question ${index + 1}`}
                value={qa.question}
                onChangeText={(value) =>
                  setQuestions((prev) =>
                    prev.map((entry, i) => (i === index ? { ...entry, question: value } : entry)),
                  )
                }
                placeholder="What is written on the sticker inside?"
              />
              <Field
                label="Answer"
                value={qa.answer}
                onChangeText={(value) =>
                  setQuestions((prev) =>
                    prev.map((entry, i) => (i === index ? { ...entry, answer: value } : entry)),
                  )
                }
                placeholder="blue-42"
                autoCapitalize="none"
              />
              {questions.length > 1 ? (
                <Pressable
                  onPress={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Text style={styles.removeLink}>Remove question</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {questions.length < 4 ? (
            <Button
              label="+ Add another question"
              variant="secondary"
              onPress={() => setQuestions((prev) => [...prev, { question: "", answer: "" }])}
            />
          ) : null}
        </Card>

        <Button
          label={busy ? "Submitting…" : type === "found" ? "Post found item" : "Post lost report"}
          onPress={submit}
          loading={busy}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  segment: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: "#EDEFF3",
    alignItems: "center",
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "center" },
  segmentTextActive: { color: "#FFFFFF" },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  sectionNote: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm, lineHeight: 18 },
  qaBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  removeLink: { color: colors.danger, fontWeight: "600", fontSize: 13 },
});
