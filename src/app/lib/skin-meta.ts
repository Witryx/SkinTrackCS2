import { readFile } from "fs/promises";
import path from "path";

const PRIMARY_SKINS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";
const LEGACY_EXTERNAL_SKINS_URL =
  "https://raw.githubusercontent.com/Spacerulerwill/CS2-API/gh-pages/api/skins.json";
const LOCAL_SKINS_PATH = path.join(process.cwd(), "src", "data", "skins.json");

const rarityMap: Record<string, string> = {
  "consumer": "Consumer",
  "consumer grade": "Consumer",
  "industrial": "Industrial",
  "industrial grade": "Industrial",
  "mil spec": "Mil-Spec",
  "mil-spec": "Mil-Spec",
  "restricted": "Restricted",
  "classified": "Classified",
  "covert": "Covert",
  "extraordinary": "Covert",
  "contraband": "Covert",
};

type RawLegacySkin = {
  formatted_name?: string;
  quality?: string;
  min_float?: string | number;
  max_float?: string | number;
  image_urls?: string[];
  containers_found_in?: string[];
};

type RawByMykelSkin = {
  name?: string;
  min_float?: string | number | null;
  max_float?: string | number | null;
  rarity?: {
    name?: string | null;
  } | null;
  image?: string | null;
  collections?: Array<{ name?: string | null }> | null;
  crates?: Array<{ name?: string | null }> | null;
};

type RawSkinMetaEntry = {
  formattedName: string;
  rarity: string | null;
  minFloat: number | null;
  maxFloat: number | null;
  imageUrl: string | null;
  containers: string[];
};

export type SkinMeta = {
  formattedName: string;
  rarity: string | null;
  minFloat: number | null;
  maxFloat: number | null;
  imageUrl: string | null;
  containers: string[];
};

export type SkinCatalogItem = SkinMeta & {
  name: string;
  weapon: string;
  skin: string;
  wear: string | null;
};

type Cache = {
  fetchedAt: number;
  map: Map<string, SkinMeta>;
  list: SkinCatalogItem[];
  byName: Map<string, SkinCatalogItem>;
};

let cache: Cache | null = null;

export function normalizeName(value: string) {
  return value.toLowerCase().replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

function stripNameDecorators(value: string) {
  if (!value) return "";
  return value
    .replace(/^\s*stattrak\S*\s+/i, "")
    .replace(/^\s*souvenir\s+/i, "")
    .replace(/^\s*[^a-z0-9]+/i, "")
    .trim();
}
export function normalizeParsedForMeta(weapon: string, skin: string) {
  const cleanedWeapon = stripNameDecorators(weapon);
  return normalizeName(`${cleanedWeapon} ${skin}`);
}

export function normalizeMarketHashForMeta(name: string) {
  if (!name) return "";
  const withoutWear = name.replace(/\([^)]+\)/g, " ");
  return normalizeName(stripNameDecorators(withoutWear));
}

function parseFormattedName(name: string) {
  const [weaponRaw, restRaw] = name.split("|").map((part) => part?.trim() ?? "");
  const rest = restRaw || weaponRaw || name;
  const wearMatch = rest.match(/\(([^)]+)\)/);
  const wear = wearMatch ? wearMatch[1] : null;
  const skin = rest.replace(/\([^)]+\)/, "").trim() || rest;

  return {
    weapon: weaponRaw || "Skin",
    skin,
    wear,
  };
}

async function loadLocalJson(): Promise<Record<string, RawLegacySkin> | null> {
  try {
    const raw = await readFile(LOCAL_SKINS_PATH, "utf8");
    return JSON.parse(raw) as Record<string, RawLegacySkin>;
  } catch (err) {
    return null;
  }
}

async function loadPrimaryJson(): Promise<RawByMykelSkin[]> {
  const res = await fetch(PRIMARY_SKINS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Primary skins fetch failed: ${res.status}`);
  }
  return (await res.json()) as RawByMykelSkin[];
}

async function loadLegacyRemoteJson(): Promise<Record<string, RawLegacySkin>> {
  const res = await fetch(LEGACY_EXTERNAL_SKINS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Legacy skins fetch failed: ${res.status}`);
  }
  return (await res.json()) as Record<string, RawLegacySkin>;
}

const normalizeRarity = (value?: string | null) => {
  if (!value) return null;
  return rarityMap[value.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
};

const parseFloatValue = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function collectNames(
  entries?: Array<{ name?: string | null }> | null
): string[] {
  if (!entries?.length) return [];
  return entries
    .map((entry) => entry.name?.trim() ?? "")
    .filter((entry) => entry.length > 0);
}

function buildLegacyEntries(
  rawJson: Record<string, RawLegacySkin>
): RawSkinMetaEntry[] {
  return Object.values(rawJson).flatMap((value) => {
    const formattedName = value.formatted_name ?? "";
    if (!formattedName) return [];

    return [
      {
        formattedName,
        rarity: normalizeRarity(value.quality),
        minFloat: parseFloatValue(value.min_float),
        maxFloat: parseFloatValue(value.max_float),
        imageUrl: value.image_urls?.[0] ?? null,
        containers: value.containers_found_in ?? [],
      },
    ];
  });
}

function buildPrimaryEntries(rawJson: RawByMykelSkin[]): RawSkinMetaEntry[] {
  return rawJson.flatMap((value) => {
    const formattedName = value.name?.trim() ?? "";
    if (!formattedName) return [];

    return [
      {
        formattedName,
        rarity: normalizeRarity(value.rarity?.name),
        minFloat: parseFloatValue(value.min_float),
        maxFloat: parseFloatValue(value.max_float),
        imageUrl: value.image ?? null,
        containers: [
          ...collectNames(value.collections),
          ...collectNames(value.crates),
        ],
      },
    ];
  });
}

function mergeMetaEntry(
  base: RawSkinMetaEntry | undefined,
  incoming: RawSkinMetaEntry
): RawSkinMetaEntry {
  if (!base) return incoming;
  return {
    formattedName: incoming.formattedName || base.formattedName,
    rarity: incoming.rarity ?? base.rarity,
    minFloat: incoming.minFloat ?? base.minFloat,
    maxFloat: incoming.maxFloat ?? base.maxFloat,
    imageUrl: incoming.imageUrl ?? base.imageUrl,
    containers: Array.from(new Set([...base.containers, ...incoming.containers])),
  };
}

function buildCache(entries: RawSkinMetaEntry[]) {
  const map = new Map<string, SkinMeta>();
  const list: SkinCatalogItem[] = [];
  const byName = new Map<string, SkinCatalogItem>();
  const seen = new Set<string>();
  const mergedEntries = new Map<string, RawSkinMetaEntry>();

  for (const entry of entries) {
    const formattedName = entry.formattedName ?? "";
    if (!formattedName) continue;
    const norm = normalizeName(formattedName);
    const current = mergedEntries.get(norm);
    mergedEntries.set(norm, mergeMetaEntry(current, entry));
  }

  for (const value of mergedEntries.values()) {
    const formattedName = value.formattedName;
    const norm = normalizeName(formattedName);
    const meta: SkinMeta = {
      formattedName,
      rarity: value.rarity,
      minFloat: value.minFloat,
      maxFloat: value.maxFloat,
      imageUrl: value.imageUrl,
      containers: value.containers,
    };

    map.set(norm, meta);
    map.set(normalizeName(formattedName.replace("|", " ")), meta);

    const parsed = parseFormattedName(formattedName);
    const entry: SkinCatalogItem = {
      ...meta,
      name: formattedName,
      weapon: parsed.weapon,
      skin: parsed.skin,
      wear: parsed.wear,
    };

    if (!seen.has(norm)) {
      list.push(entry);
      seen.add(norm);
    }

    if (!byName.has(norm)) {
      byName.set(norm, entry);
    }
    const normAlt = normalizeName(formattedName.replace("|", " "));
    if (!byName.has(normAlt)) {
      byName.set(normAlt, entry);
    }
  }

  return { map, list, byName };
}

async function getSkinMetaCache(): Promise<Cache> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < 1000 * 60 * 30) {
    return cache;
  }

  const [primaryJson, localLegacyJson] = await Promise.all([
    loadPrimaryJson().catch(() => null),
    loadLocalJson(),
  ]);
  const legacyJson =
    localLegacyJson ?? (await loadLegacyRemoteJson().catch(() => null));

  const entries = [
    ...buildLegacyEntries(legacyJson ?? {}),
    ...buildPrimaryEntries(primaryJson ?? []),
  ];
  const built = buildCache(entries);
  cache = { ...built, fetchedAt: now };
  return cache;
}

export async function getSkinMetaMap(): Promise<Map<string, SkinMeta>> {
  const metaCache = await getSkinMetaCache();
  return metaCache.map;
}

export async function getSkinCatalog(): Promise<SkinCatalogItem[]> {
  const metaCache = await getSkinMetaCache();
  return metaCache.list;
}

export async function findSkinInCatalog(name: string) {
  if (!name) return null;
  const metaCache = await getSkinMetaCache();
  const norm = normalizeName(name);
  const direct = metaCache.byName.get(norm);
  if (direct) return direct;
  const alt = normalizeMarketHashForMeta(name);
  return metaCache.byName.get(alt) ?? null;
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

