import {
  findSkinInCatalog,
  getSkinCatalog,
  normalizeMarketHashForMeta,
  normalizeName,
  type SkinCatalogItem,
} from "./skin-meta";
import { resolveRarity } from "./rarity";
import {
  isWeaponMatchingFilter,
  isWeaponInSkinCategory,
  resolveSkinCategory,
  resolveSkinWeaponKey,
} from "./skin-categories";
import type { SkinSearchFilters, SkinSearchResult } from "./skin-database";
import type { SkinDetail } from "./skinport";

const buildSteamMarketUrl = (name: string) =>
  `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`;

const matchesQuery = (item: SkinCatalogItem, qNorm: string) => {
  if (!qNorm) return true;
  const nameNorm = normalizeName(item.name);
  if (nameNorm.includes(qNorm)) return true;
  const weaponNorm = normalizeName(item.weapon);
  if (weaponNorm.includes(qNorm)) return true;
  const skinNorm = normalizeName(item.skin);
  return skinNorm.includes(qNorm);
};

const toSearchResult = (item: SkinCatalogItem, index: number): SkinSearchResult => {
  const rarity = item.rarity ?? resolveRarity(null);
  const url = buildSteamMarketUrl(item.name);
  return {
    id: -(index + 1),
    name: item.name,
    weapon: item.weapon,
    skin: item.skin,
    wear: item.wear,
    rarity,
    minFloat: item.minFloat,
    maxFloat: item.maxFloat,
    price: null,
    medianPrice: null,
    suggestedPrice: null,
    volume7d: null,
    median7d: null,
    quantity: null,
    itemPage: null,
    marketPage: url,
  };
};

export async function searchSkinsLocal(
  filters: SkinSearchFilters
): Promise<SkinSearchResult[]> {
  const { q, rarity, category, weapon, limit = 60, sort = "volume" } = filters;
  const list = await getSkinCatalog();
  const qNorm = normalizeMarketHashForMeta(q?.trim() ?? "");
  const rarityFilter = rarity && rarity !== "all" ? rarity : null;
  const resolvedCategory = resolveSkinCategory(category);
  const resolvedWeapon = resolveSkinWeaponKey(weapon);

  const filtered = list.filter((item) => {
    if (rarityFilter) {
      const resolved = item.rarity ?? resolveRarity(null);
      if (resolved !== rarityFilter) return false;
    }
    if (resolvedCategory) {
      const isInCategory = isWeaponInSkinCategory(
        item.weapon,
        item.name,
        resolvedCategory
      );
      if (!isInCategory) return false;
    }
    if (resolvedWeapon) {
      const isWeaponMatch = isWeaponMatchingFilter(
        item.weapon,
        item.name,
        resolvedWeapon
      );
      if (!isWeaponMatch) return false;
    }
    return matchesQuery(item, qNorm);
  });

  const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "most-expensive") {
    sorted.reverse();
  }

  return sorted.slice(0, limit).map(toSearchResult);
}

export async function getSkinDetailLocal(name: string): Promise<SkinDetail | null> {
  if (!name) return null;
  const item = await findSkinInCatalog(name);
  if (!item) return null;
  const rarity = item.rarity ?? resolveRarity(null);
  const url = buildSteamMarketUrl(item.name);

  return {
    name: item.name,
    weapon: item.weapon,
    skin: item.skin,
    wear: item.wear,
    price: null,
    volume7d: null,
    median7d: null,
    quantity: null,
    rarity,
    marketPage: url,
    minPrice: null,
    maxPrice: null,
    meanPrice: null,
    medianPrice: null,
    suggestedPrice: null,
  };
}
