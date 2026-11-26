/**
 * License-free category artwork used when a listing has no photo.
 *
 * These are intentionally illustrations rather than stock photos: they load
 * instantly, stay crisp at any size, and cannot be mistaken for the actual
 * item. Listings that do have a real photo always use the photo instead.
 */
const CATEGORY_ART: Record<string, { src: string; label: string }> = {
  "phones-tablets": { src: "/demo/phone.svg", label: "Phone" },
  "laptops-chargers": { src: "/demo/charger.svg", label: "Charger" },
  "headphones-audio": { src: "/demo/headphones.svg", label: "Headphones" },
  keys: { src: "/demo/keys.svg", label: "Keys" },
  "wallets-cards": { src: "/demo/wallet.svg", label: "Wallet" },
  "bags-backpacks": { src: "/demo/backpack.svg", label: "Backpack" },
  "books-stationery": { src: "/demo/textbook.svg", label: "Book" },
  "clothing-accessories": { src: "/demo/hoodie.svg", label: "Clothing" },
  "water-bottles": { src: "/demo/bottle.svg", label: "Bottle" },
  "documents-ids": { src: "/demo/id-card.svg", label: "ID card" },
};

export function categoryArtwork(categoryId: string) {
  return CATEGORY_ART[categoryId] ?? null;
}
