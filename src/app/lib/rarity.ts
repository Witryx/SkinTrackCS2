export type Rarity =
  | "Consumer" // gray
  | "Industrial" // light blue
  | "Mil-Spec" // blue
  | "Restricted" // purple
  | "Classified" // pink
  | "Covert"; // red

export const rarityBgClass: Record<Rarity, string> = {
  Consumer: "bg-gray-600",
  Industrial: "bg-sky-500",
  "Mil-Spec": "bg-blue-600",
  Restricted: "bg-purple-700",
  Classified: "bg-fuchsia-600",
  Covert: "bg-red-600",
};

export const rarityTextClass: Record<Rarity, string> = {
  Consumer: "text-gray-300",
  Industrial: "text-sky-200",
  "Mil-Spec": "text-blue-200",
  Restricted: "text-purple-200",
  Classified: "text-fuchsia-200",
  Covert: "text-red-200",
};

export const rarityOptions: Array<{ value: Rarity | "all"; label: string }> = [
  { value: "all", label: "Vsechny kvality" },
  { value: "Consumer", label: "Consumer" },
  { value: "Industrial", label: "Industrial" },
  { value: "Mil-Spec", label: "Mil-Spec" },
  { value: "Restricted", label: "Restricted" },
  { value: "Classified", label: "Classified" },
  { value: "Covert", label: "Covert" },
];

// Heuristika: hadujeme rarity jen podle ceny (Skinport neposila raritu)
export function resolveRarity(price: number | null | undefined): Rarity {
  const p = typeof price === "number" ? price : 0;

  if (p >= 300) return "Covert";
  if (p >= 120) return "Classified";
  if (p >= 40) return "Restricted";
  if (p >= 10) return "Mil-Spec";
  if (p >= 3) return "Industrial";
  return "Consumer";
}
