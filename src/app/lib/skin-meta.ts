import { readFile } from "fs/promises";
import path from "path";

const EXTERNAL_SKINS_URL =
  "https://raw.githubusercontent.com/Spacerulerwill/CS2-API/gh-pages/api/skins.json";
const LOCAL_SKINS_PATH = path.join(process.cwd(), "src", "data", "skins.json");

const rarityMap: Record<string, string> = {
  "consumer grade": "Consumer",
  "industrial grade": "Industrial",
  "mil-spec": "Mil-Spec",
  "restricted": "Restricted",
  "classified": "Classified",
  "covert": "Covert",
};

type RawSkin = {
  formatted_name?: string;
  quality?: string;
  min_float?: string | number;
  max_float?: string | number;
  image_urls?: string[];
};

export type SkinMeta = {
  formattedName: string;
  rarity: string | null;
  minFloat: number | null;
  maxFloat: number | null;
  imageUrl: string | null;
};

type Cache = {
  fetchedAt: number;
  map: Map<string, SkinMeta>;
};

let cache: Cache | null = null;

export function normalizeName(value: string) {
  return value.toLowerCase().replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeParsedForMeta(weapon: string, skin: string) {
  const cleanedWeapon = weapon
    .replace(/^stattrak™\s+/i, "")
    .replace(/^souvenir\s+/i, "")
    .replace(/^★\s*/i, "")
    .trim();
  return normalizeName(`${cleanedWeapon} ${skin}`);
}

export function normalizeMarketHashForMeta(name: string) {
  if (!name) return "";
  const withoutWear = name.replace(/\([^)]+\)/g, " ");
  return normalizeName(
    withoutWear
      .replace(/^stattrak™\s+/i, "")
      .replace(/^souvenir\s+/i, "")
      .replace(/^★\s*/i, "")
  );
}

async function loadLocalJson(): Promise<Record<string, RawSkin> | null> {
  try {
    const raw = await readFile(LOCAL_SKINS_PATH, "utf8");
    return JSON.parse(raw) as Record<string, RawSkin>;
  } catch (err) {
    return null;
  }
}

async function loadRemoteJson(): Promise<Record<string, RawSkin>> {
  const res = await fetch(EXTERNAL_SKINS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`External skins fetch failed: ${res.status}`);
  }
  return (await res.json()) as Record<string, RawSkin>;
}

export async function getSkinMetaMap(): Promise<Map<string, SkinMeta>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < 1000 * 60 * 30) {
    return cache.map;
  }

  const rawJson = (await loadLocalJson()) ?? (await loadRemoteJson());

  const map = new Map<string, SkinMeta>();

  for (const value of Object.values(rawJson)) {
    const formattedName = value.formatted_name ?? "";
    if (!formattedName) continue;
    const norm = normalizeName(formattedName);
    const rarity =
      value.quality && rarityMap[value.quality.toLowerCase()]
        ? rarityMap[value.quality.toLowerCase()]
        : null;
    const minFloat =
      typeof value.min_float === "number"
        ? value.min_float
        : value.min_float
          ? parseFloat(value.min_float)
          : null;
    const maxFloat =
      typeof value.max_float === "number"
        ? value.max_float
        : value.max_float
          ? parseFloat(value.max_float)
          : null;
    const imageUrl = value.image_urls?.[0] ?? null;

    const meta: SkinMeta = {
      formattedName,
      rarity,
      minFloat,
      maxFloat,
      imageUrl,
    };

    map.set(norm, meta);
    map.set(normalizeName(formattedName.replace("|", " ")), meta);
  }

  cache = { map, fetchedAt: now };
  return map;
}

export async function lookupSkinMeta(name: string) {
  if (!name) return null;
  const map = await getSkinMetaMap();
  const norm = normalizeName(name);
  return map.get(norm) ?? null;
}

export function lookupSkinMetaFromParsed(
  map: Map<string, SkinMeta> | null | undefined,
  weapon: string,
  skin: string,
  marketHashName?: string
) {
  if (!map) return null;
  const key = normalizeParsedForMeta(weapon, skin);
  const byParsed = map.get(key);
  if (byParsed) return byParsed;
  if (marketHashName) {
    const mh = normalizeMarketHashForMeta(marketHashName);
    const byMarketHash = map.get(mh);
    if (byMarketHash) return byMarketHash;
  }
  return null;
}
