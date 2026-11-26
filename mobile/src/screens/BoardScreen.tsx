import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import type { BoardPage, Taxonomy } from "../api/types";
import { ItemCard } from "../components/ItemCard";
import { PickerField } from "../components/PickerField";
import { Banner, EmptyState, Loading } from "../components/ui";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, radius, spacing } from "../theme";
import { useAsync } from "../state/useAsync";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Board">,
  NativeStackScreenProps<RootStackParamList>
>;

const STATES = [
  { id: "default", label: "Active only" },
  { id: "open", label: "Open" },
  { id: "claim_pending", label: "Claim pending" },
  { id: "in_custody", label: "In custody" },
  { id: "returned", label: "Returned" },
  { id: "disposal_pending", label: "Disposal queue" },
  { id: "all", label: "Everything" },
];

export function BoardScreen({ navigation }: Props) {
  const taxonomy = useAsync<Taxonomy>(() => api.get<Taxonomy>("/api/taxonomy"), []);
  const [type, setType] = useState<"all" | "lost" | "found">("all");
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [items, setItems] = useState<BoardPage["items"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "reset" | "more", previous: BoardPage["items"]) => {
      try {
        const page = await api.get<BoardPage>("/api/board", {
          type: type === "all" ? undefined : type,
          category,
          location,
          state,
          q: search || undefined,
          before: mode === "more" ? cursor : undefined,
          limit: 20,
        });
        setItems(mode === "more" ? [...previous, ...page.items] : page.items);
        setCursor(page.nextCursor);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the board");
      }
    },
    [type, category, location, state, search, cursor],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load("reset", []);
    setRefreshing(false);
  }, [load]);

  React.useEffect(() => {
    setLoading(true);
    load("reset", []).finally(() => setLoading(false));
  }, [load]);

  const categoryOptions = useMemo(
    () =>
      (taxonomy.data?.categories ?? []).map((entry) => ({
        id: entry.id,
        label: entry.name,
      })),
    [taxonomy.data],
  );

  const locationOptions = useMemo(
    () =>
      (taxonomy.data?.locations ?? []).map((entry) => ({
        id: entry.id,
        label: entry.path.length > 1 ? entry.path.join(" › ") : entry.name,
      })),
    [taxonomy.data],
  );

  const activeFilters = [category, location, state].filter(Boolean).length;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search title or description"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSearch(query.trim())}
          returnKeyType="search"
        />
        <Pressable
          onPress={() => {
            setSearch(query.trim());
            setShowFilters((value) => !value);
          }}
          style={styles.filterButton}
        >
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          {activeFilters > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      <View style={styles.segment}>
        {(["all", "lost", "found"] as const).map((value) => (
          <Pressable
            key={value}
            style={[styles.segmentItem, type === value && styles.segmentActive]}
            onPress={() => setType(value)}
          >
            <Text style={[styles.segmentText, type === value && styles.segmentTextActive]}>
              {value === "all" ? "All" : value === "lost" ? "Lost" : "Found"}
            </Text>
          </Pressable>
        ))}
      </View>

      {showFilters ? (
        <View style={styles.filters}>
          <PickerField
            label="Category"
            placeholder="Any category"
            options={categoryOptions}
            value={category}
            onChange={setCategory}
          />
          <PickerField
            label="Location"
            placeholder="Anywhere on campus"
            options={locationOptions}
            value={location}
            onChange={setLocation}
          />
          <PickerField
            label="Status"
            placeholder="Active only"
            options={STATES}
            value={state}
            onChange={setState}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.bannerWrap}>
          <Banner kind="error" message={error} />
        </View>
      ) : null}

      {loading ? (
        <Loading label="Loading the board…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (cursor && !loading) void load("more", items);
          }}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              subtitle="Try different filters, or report something you lost or found."
            />
          }
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() => navigation.navigate("ItemDetail", { itemId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  segment: {
    flexDirection: "row",
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: "#EDEFF3",
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  segmentTextActive: { color: colors.text },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerWrap: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
});
