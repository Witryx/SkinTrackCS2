// lib/mock/skins.ts
export type Rarity = "Common" | "Uncommon" | "Rare" | "Mythical" | "Legendary";

export type Skin = {
  id: string;
  name: string;
  weapon: string;
  rarity: Rarity;
  price: number;
  image?: string;
};

export const mockSkins: Skin[] = [
  { id: "ak-redline", name: "AK-47 | Redline", weapon: "AK-47", rarity: "Mythical", price: 19.9, image: "/skins/ak_redline.png" },
  { id: "awp-asiimov", name: "AWP | Asiimov", weapon: "AWP", rarity: "Legendary", price: 149.0, image: "/skins/awp_asiimov.png" },
  { id: "glock-water", name: "Glock-18 | Water Elemental", weapon: "Glock-18", rarity: "Rare", price: 5.1, image: "/skins/glock_water_elemental.png" },
  { id: "m4a1s-printstream", name: "M4A1-S | Printstream", weapon: "M4A1-S", rarity: "Legendary", price: 310.0, image: "/skins/m4a1s_printstream.png" },
];

// barvy štítů/proužků podle rarity
export const rarityColors: Record<Rarity, string> = {
  Common: "gray",
  Uncommon: "green",
  Rare: "blue",
  Mythical: "purple",
  Legendary: "orange",
};


export const rarityBgClass: Record<Rarity, string> = {
  Common: "bg-gray-500",
  Uncommon: "bg-green-500",
  Rare: "bg-blue-500",
  Mythical: "bg-purple-500",
  Legendary: "bg-orange-500",
};

export const rarityTextClass: Record<Rarity, string> = {
  Common: "text-gray-400",
  Uncommon: "text-green-400",
  Rare: "text-blue-400",
  Mythical: "text-purple-400",
  Legendary: "text-orange-400",
};
