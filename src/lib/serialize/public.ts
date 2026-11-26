import type { ItemCategoryDoc, ItemDoc, LocationDoc } from "@/models/types";

/**
 * PUBLIC SERIALIZATION LAYER (Track J redaction).
 *
 * Everything the outside world is allowed to know about an item is declared
 * here, as an explicit allow-list. The private identifying details live in a
 * separate collection (`private_details`) that this module does not import, so
 * a private field cannot reach a public response by accident: there is no code
 * path from that collection into these types.
 *
 * `toPublicItem` is the only function allowed to turn an ItemDoc into a
 * response body. Never spread an ItemDoc (or any other DB document) into JSON.
 */

export interface TaxonomyLookup {
  categoryName(id: string): string;
  locationName(id: string): string;
  /** Location names, root to leaf. */
  locationPath(id: string): string[];
}

export const NO_TAXONOMY: TaxonomyLookup = {
  categoryName: () => "Uncategorised",
  locationName: () => "Unknown",
  locationPath: () => [],
};

export interface PublicItem {
  id: string;
  type: "lost" | "found";
  title: string;
  description: string;
  category: { id: string; name: string };
  location: { id: string; name: string; path: string[] };
  occurredAt: string;
  postedAt: string;
  status: ItemDoc["status"];
  images: string[];
  attributes: Record<string, string>;
  claimable: boolean;
  hasVerification: boolean;
  redacted: true;
}

export interface PublicCategory {
  id: string;
  name: string;
  parentId: string | null;
  attributes: string[];
}

export interface PublicLocation {
  id: string;
  name: string;
  parentId: string | null;
  path: string[];
}

const CLAIMABLE_STATUSES: ItemDoc["status"][] = ["open", "claim_pending"];

export function toPublicItem(item: ItemDoc, tax: TaxonomyLookup = NO_TAXONOMY): PublicItem {
  return {
    id: item._id,
    type: item.type,
    title: item.title,
    description: item.description,
    category: { id: item.categoryId, name: tax.categoryName(item.categoryId) },
    location: {
      id: item.locationId,
      name: tax.locationName(item.locationId),
      path: tax.locationPath(item.locationId),
    },
    occurredAt: item.occurredAt.toISOString(),
    postedAt: item.createdAt.toISOString(),
    status: item.status,
    images: item.images,
    attributes: item.attributes,
    claimable: item.type === "found" && CLAIMABLE_STATUSES.includes(item.status),
    hasVerification: item.hasPrivateDetails,
    redacted: true,
  };
}

export function toPublicCategory(category: ItemCategoryDoc): PublicCategory {
  return {
    id: category._id,
    name: category.name,
    parentId: category.parentId,
    attributes: category.attributes,
  };
}

export function toPublicLocation(location: LocationDoc, tax: TaxonomyLookup): PublicLocation {
  return {
    id: location._id,
    name: location.name,
    parentId: location.parentId,
    path: tax.locationPath(location._id),
  };
}

/**
 * Board/list projection - a narrow subset of PublicItem so list responses stay
 * small and cannot grow private fields by drift.
 */
export type PublicListItem = Pick<
  PublicItem,
  | "id"
  | "type"
  | "title"
  | "category"
  | "location"
  | "occurredAt"
  | "postedAt"
  | "status"
  | "images"
  | "claimable"
  | "redacted"
>;

export function toPublicListItem(item: PublicItem): PublicListItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    category: item.category,
    location: item.location,
    occurredAt: item.occurredAt,
    postedAt: item.postedAt,
    status: item.status,
    images: item.images.slice(0, 1),
    claimable: item.claimable,
    redacted: true,
  };
}
