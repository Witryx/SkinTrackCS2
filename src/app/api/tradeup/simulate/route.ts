import { NextRequest, NextResponse } from "next/server";
import {
  getSkinMetaMap,
  normalizeMarketHashForMeta,
  SkinMeta,
} from "@/app/lib/skin-meta";
import {
  getSkinportHistory,
  getSkinportItems,
  parseMarketHashName,
  SkinportHistoryItem,
  SkinportItem,
} from "@/app/lib/skinport";
import { isWeaponInSkinCategory } from "@/app/lib/skin-categories";
import { prisma } from "@/app/lib/prisma";

type InputItem = {
  name: string;
  float?: number | null;
};

type SimMode = "standard" | "knife";
type ItemVariant = "regular" | "stattrak" | "souvenir";
type SpecialKind = "knife" | "gloves" | null;

const rarityOrder = [
  "Consumer",
  "Industrial",
  "Mil-Spec",
  "Restricted",
  "Classified",
  "Covert",
] as const;

const wearRanges: Array<{ name: string; min: number; max: number }> = [
  { name: "Factory New", min: 0, max: 0.07 },
  { name: "Minimal Wear", min: 0.07, max: 0.15 },
  { name: "Field-Tested", min: 0.15, max: 0.38 },
  { name: "Well-Worn", min: 0.38, max: 0.45 },
  { name: "Battle-Scarred", min: 0.45, max: 1 },
];

const getWearFromFloat = (value: number) => {
  for (const range of wearRanges) {
    if (value >= range.min && value < range.max) return range.name;
  }
  return "Battle-Scarred";
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getItemVariant = (name: string): ItemVariant => {
  if (/^\s*souvenir\s+/i.test(name)) return "souvenir";
  if (/^\s*stattrak\S*\s+/i.test(name)) return "stattrak";
  return "regular";
};

const getInputFloat = (item: InputItem, meta: SkinMeta) => {
  const min = meta.minFloat ?? 0;
  const max = meta.maxFloat ?? 1;
  const fallback = clamp((min + max) / 2, min, max);
  const value =
    typeof item.float === "number" && Number.isFinite(item.float)
      ? item.float
      : fallback;
  return clamp(value, min, max);
};

const getNormalizedInputFloat = (value: number, meta: SkinMeta) => {
  const min = meta.minFloat ?? 0;
  const max = meta.maxFloat ?? 1;
  const range = max - min;
  if (range <= 0) return 0;
  return clamp((value - min) / range, 0, 1);
};

const priceFromItem = (item?: SkinportItem | null) => {
  if (!item) return null;
  return item.min_price ?? item.median_price ?? item.suggested_price ?? null;
};

const priceFromHistory = (item?: SkinportHistoryItem | null) => {
  if (!item) return null;
  return (
    item.last_7_days?.median ??
    item.last_7_days?.avg ??
    item.last_30_days?.median ??
    item.last_30_days?.avg ??
    item.last_90_days?.median ??
    item.last_90_days?.avg ??
    null
  );
};

const buildLookupKey = (marketHashName: string) => {
  const parsed = parseMarketHashName(marketHashName);
  const weaponLower = parsed.weapon.toLowerCase();
  const wear = (parsed.wear ?? "").toLowerCase();
  const stattrak = weaponLower.includes("stattrak") ? "st" : "nost";
  const souvenir = weaponLower.includes("souvenir") ? "sou" : "nos";
  const normalized = normalizeMarketHashForMeta(marketHashName);
  return `${normalized}|${wear}|${stattrak}|${souvenir}`;
};

const getCollections = (meta?: SkinMeta | null) => {
  if (!meta) return [];
  if (meta.collections?.length) return meta.collections;
  return meta.containers ?? [];
};

const getContainers = (meta?: SkinMeta | null) => {
  if (!meta) return [];
  const collections = new Set(getCollections(meta));
  const containers = meta.containers ?? [];
  const casePools = containers.filter((pool) => !collections.has(pool));
  return casePools.length ? casePools : containers;
};

const getWeaponFromFormattedName = (value: string) =>
  value.split("|")[0]?.trim() ?? value.trim();

const getSpecialKind = (meta: SkinMeta): SpecialKind => {
  const weapon = getWeaponFromFormattedName(meta.formattedName);
  if (isWeaponInSkinCategory(weapon, meta.formattedName, "gloves")) return "gloves";
  if (isWeaponInSkinCategory(weapon, meta.formattedName, "knife")) return "knife";
  return null;
};

const getTradeupPools = (meta: SkinMeta | null | undefined, mode: SimMode) => {
  if (!meta) return [];
  if (mode === "knife") return getContainers(meta);
  return getCollections(meta);
};

const getPrimaryTradeupPool = (
  meta: SkinMeta | null | undefined,
  mode: SimMode
) => {
  const pools = getTradeupPools(meta, mode);
  if (mode === "standard") {
    return (
      pools.find((pool) => /\bcollection\b/i.test(pool)) ??
      pools[0] ??
      "Unknown"
    );
  }
  return pools[0] ?? "Unknown";
};

const stripSpecialPrefix = (value: string) =>
  value.replace(/^\s*\u2605\s*/u, "").trim();

const isVanillaSpecial = (meta: SkinMeta) =>
  /\|\s*.*vanilla/i.test(meta.formattedName);

const buildSpecialBaseName = (meta: SkinMeta, variant: ItemVariant) => {
  const formatted = stripSpecialPrefix(meta.formattedName);
  const weapon = stripSpecialPrefix(getWeaponFromFormattedName(formatted));
  const withoutVanilla = isVanillaSpecial(meta) ? weapon : formatted;
  const specialKind = getSpecialKind(meta);
  const statTrakPrefix =
    variant === "stattrak" && specialKind === "knife"
      ? "StatTrak\u2122 "
      : "";
  return `\u2605 ${statTrakPrefix}${withoutVanilla}`.trim();
};

const buildMarketHashName = (
  meta: SkinMeta,
  wear: string,
  mode: SimMode,
  variant: ItemVariant
) => {
  if (mode === "knife") {
    const baseName = buildSpecialBaseName(meta, variant);
    return isVanillaSpecial(meta) ? baseName : `${baseName} (${wear})`;
  }

  const prefix = variant === "stattrak" ? "StatTrak\u2122 " : "";
  return `${prefix}${meta.formattedName} (${wear})`;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const items: InputItem[] = Array.isArray(body?.items) ? body.items : [];
    const mode: SimMode = body?.mode === "knife" ? "knife" : "standard";
    const requiredItems = mode === "knife" ? 5 : 10;
    const poolKind = mode === "knife" ? "case" : "collection";

    if (items.length !== requiredItems) {
      return NextResponse.json(
        {
          error:
            mode === "knife"
              ? "Knife trade-up vyžaduje přesně 5 Covert skinů."
              : "Je potřeba přesně 10 skinů.",
        },
        { status: 400 }
      );
    }

    const metaMap = await getSkinMetaMap();
    const byFormatted = new Map<string, SkinMeta>();
    for (const meta of metaMap.values()) {
      byFormatted.set(meta.formattedName, meta);
    }

    const resolved = items.map((item) => {
      const key = normalizeMarketHashForMeta(item.name);
      const meta = metaMap.get(key) ?? null;
      const variant = getItemVariant(item.name);
      return { item, meta, variant };
    });

    if (resolved.some((entry) => !entry.meta)) {
      return NextResponse.json(
        { error: "Některé skiny se nepodařilo najít v meta databázi." },
        { status: 400 }
      );
    }

    if (resolved.some((entry) => entry.variant === "souvenir")) {
      return NextResponse.json(
        { error: "Souvenir skiny nejdou použít v Trade Up Contractu." },
        { status: 400 }
      );
    }

    const contractVariant = resolved[0]?.variant ?? "regular";
    if (resolved.some((entry) => entry.variant !== contractVariant)) {
      return NextResponse.json(
        { error: "Nelze míchat StatTrak a regular skiny v jednom contractu." },
        { status: 400 }
      );
    }

    const rarity = resolved[0]?.meta?.rarity ?? null;
    if (!rarity) {
      return NextResponse.json(
        { error: "Nelze určit raritu vstupních skinů." },
        { status: 400 }
      );
    }

    if (resolved.some((entry) => entry.meta?.rarity !== rarity)) {
      return NextResponse.json(
        { error: "Všechny skiny musí mít stejnou raritu." },
        { status: 400 }
      );
    }

    if (resolved.some((entry) => getSpecialKind(entry.meta!) !== null)) {
      return NextResponse.json(
        { error: "Nože a rukavice nejdou použít jako input do trade-up contractu." },
        { status: 400 }
      );
    }

    if (mode === "knife" && rarity !== "Covert") {
      return NextResponse.json(
        { error: "Knife trade-up funguje jen pro 5 Covert skinů." },
        { status: 400 }
      );
    }

    const rarityIndex = rarityOrder.indexOf(rarity as (typeof rarityOrder)[number]);
    const nextRarity =
      mode === "knife"
        ? "Special"
        : rarityIndex >= 0 && rarityIndex < rarityOrder.length - 1
          ? rarityOrder[rarityIndex + 1]
          : null;

    if (!nextRarity) {
      return NextResponse.json(
        { error: "Pro tuto raritu nelze trade-up vypočítat." },
        { status: 400 }
      );
    }

    const poolCounts = new Map<string, number>();
    for (const entry of resolved) {
      const pool = getPrimaryTradeupPool(entry.meta, mode);
      poolCounts.set(pool, (poolCounts.get(pool) ?? 0) + 1);
    }

    const poolIndex = new Map<string, SkinMeta[]>();
    const specialKindsByPool = new Map<string, Set<SpecialKind>>();
    for (const meta of byFormatted.values()) {
      if (mode === "knife") {
        const specialKind = getSpecialKind(meta);
        if (!specialKind) continue;
        const pools = getTradeupPools(meta, mode);
        if (!pools.length) continue;
        for (const pool of pools) {
          const kinds = specialKindsByPool.get(pool) ?? new Set<SpecialKind>();
          kinds.add(specialKind);
          specialKindsByPool.set(pool, kinds);
        }
        if (contractVariant === "stattrak" && specialKind !== "knife") continue;
      } else {
        if (getSpecialKind(meta)) continue;
        if (meta.rarity !== nextRarity) continue;
      }

      const pools = getTradeupPools(meta, mode);
      if (!pools.length) continue;
      for (const pool of pools) {
        const list = poolIndex.get(pool) ?? [];
        list.push(meta);
        poolIndex.set(pool, list);
      }
    }

    const poolsWithoutOutcomes = Array.from(poolCounts.keys()).filter(
      (pool) => !(poolIndex.get(pool)?.length)
    );
    if (poolsWithoutOutcomes.length) {
      if (mode === "knife" && contractVariant === "stattrak") {
        const gloveOnlyPool = poolsWithoutOutcomes.find((pool) => {
          const kinds = specialKindsByPool.get(pool);
          return !!kinds?.has("gloves") && !kinds.has("knife");
        });
        if (gloveOnlyPool) {
          return NextResponse.json(
            {
              error: `Case pool "${gloveOnlyPool}" má jen gloves. StatTrak Covert lze tradeupnout jen do StatTrak nože.`,
            },
            { status: 400 }
          );
        }
      }
      return NextResponse.json(
        {
          error: `Pro ${poolKind} pool "${poolsWithoutOutcomes[0]}" nejsou žádné platné outputy.`,
        },
        { status: 400 }
      );
    }

    const inputFloats = resolved.map((entry) => {
      const float = getInputFloat(entry.item, entry.meta!);
      return {
        raw: float,
        normalized: getNormalizedInputFloat(float, entry.meta!),
      };
    });

    const avgFloat =
      inputFloats.reduce((sum, entry) => sum + entry.raw, 0) /
      inputFloats.length;
    const avgNormalizedFloat =
      inputFloats.reduce((sum, entry) => sum + entry.normalized, 0) /
      inputFloats.length;

    const outputs = new Map<
      string,
      {
        name: string;
        marketHashName: string;
        probability: number;
        float: number;
        wear: string;
        rarity: string;
        price: number | null;
        currency: string | null;
        collection: string;
        pools: Set<string>;
      }
    >();

    const [skinportItems, skinportHistory] = await Promise.all([
      getSkinportItems(),
      getSkinportHistory().catch(() => []),
    ]);
    const skinportByLookup = new Map<string, SkinportItem>();
    const historyByLower = new Map<string, SkinportHistoryItem>();
    const historyByLookup = new Map<string, SkinportHistoryItem>();
    for (const item of Object.values(skinportItems)) {
      const key = buildLookupKey(item.market_hash_name);
      if (!skinportByLookup.has(key)) {
        skinportByLookup.set(key, item);
      }
    }
    for (const item of skinportHistory) {
      historyByLower.set(item.market_hash_name.toLowerCase(), item);
      const key = buildLookupKey(item.market_hash_name);
      if (!historyByLookup.has(key)) {
        historyByLookup.set(key, item);
      }
    }

    for (const [pool, count] of poolCounts.entries()) {
      const outcomes = poolIndex.get(pool) ?? [];
      if (!outcomes.length) continue;
      const perPoolProbability = count / requiredItems;
      const perItemProbability = perPoolProbability / outcomes.length;

      for (const meta of outcomes) {
        const min = meta.minFloat ?? 0;
        const max = meta.maxFloat ?? 1;
        const outputFloat = clamp(
          avgNormalizedFloat * (max - min) + min,
          min,
          max
        );
        const wear = isVanillaSpecial(meta) ? "Vanilla" : getWearFromFloat(outputFloat);
        const marketHashName = buildMarketHashName(
          meta,
          wear,
          mode,
          contractVariant
        );

        const existing = outputs.get(marketHashName);
        if (existing) {
          existing.probability += perItemProbability;
          existing.pools.add(pool);
          continue;
        }

        outputs.set(marketHashName, {
          name: meta.formattedName,
          marketHashName,
          probability: perItemProbability,
          float: outputFloat,
          wear,
          rarity: mode === "knife" ? "Special" : meta.rarity ?? nextRarity,
          price: null,
          currency: null,
          collection: pool,
          pools: new Set([pool]),
        });
      }
    }

    const outputNames = Array.from(outputs.keys());
    const outputSkins = Array.from(
      new Set(
        outputNames
          .map((name) => parseMarketHashName(name).skin)
          .filter((skin) => skin.length > 0)
      )
    );

    const [dbExactRows, dbCandidates] = await Promise.all([
      prisma.skin.findMany({
        where: { marketHashName: { in: outputNames } },
        select: {
          marketHashName: true,
          price: true,
          currency: true,
        },
      }),
      outputSkins.length
        ? prisma.skin.findMany({
            where: { skin: { in: outputSkins } },
            select: {
              marketHashName: true,
              price: true,
              currency: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const dbByLower = new Map<
      string,
      { price: number | null; currency: string | null }
    >();
    for (const row of dbExactRows) {
      dbByLower.set(row.marketHashName.toLowerCase(), {
        price: row.price ?? null,
        currency: row.currency ?? "EUR",
      });
    }

    const dbByLookup = new Map<
      string,
      { price: number | null; currency: string | null }
    >();
    for (const row of dbCandidates) {
      const key = buildLookupKey(row.marketHashName);
      if (!dbByLookup.has(key)) {
        dbByLookup.set(key, {
          price: row.price ?? null,
          currency: row.currency ?? "EUR",
        });
      }
    }

    const resolvePrice = (marketHashName: string) => {
      const normalized = marketHashName.toLowerCase();
      const lookupKey = buildLookupKey(marketHashName);
      const exactSkinport = skinportItems[normalized] ?? skinportItems[marketHashName];
      const normalizedSkinport = skinportByLookup.get(lookupKey) ?? null;
      const exactHistory = historyByLower.get(normalized) ?? null;
      const normalizedHistory = historyByLookup.get(lookupKey) ?? null;

      const skinportPrice = priceFromItem(exactSkinport ?? normalizedSkinport);
      if (skinportPrice !== null) {
        return {
          price: skinportPrice,
          currency:
            exactSkinport?.currency ?? normalizedSkinport?.currency ?? "EUR",
        };
      }

      const historyPrice = priceFromHistory(exactHistory ?? normalizedHistory);
      if (historyPrice !== null) {
        return {
          price: historyPrice,
          currency:
            exactHistory?.currency ??
            normalizedHistory?.currency ??
            exactSkinport?.currency ??
            normalizedSkinport?.currency ??
            "EUR",
        };
      }

      const dbExact = dbByLower.get(normalized) ?? null;
      if (dbExact && dbExact.price !== null) {
        return {
          price: dbExact.price,
          currency: dbExact.currency ?? "EUR",
        };
      }

      const dbNormalized = dbByLookup.get(lookupKey) ?? null;
      if (dbNormalized && dbNormalized.price !== null) {
        return {
          price: dbNormalized.price,
          currency: dbNormalized.currency ?? "EUR",
        };
      }

      return {
        price: null,
        currency:
          exactSkinport?.currency ??
          normalizedSkinport?.currency ??
          dbExact?.currency ??
          dbNormalized?.currency ??
          "EUR",
      };
    };

    const resolvedOutputs = Array.from(outputs.values()).map((output) => {
      const resolvedPrice = resolvePrice(output.marketHashName);
      const { pools, ...rest } = output;
      return {
        ...rest,
        price: resolvedPrice.price,
        currency: resolvedPrice.currency,
        collection: Array.from(pools).join(", "),
      };
    });

    const expectedValue = resolvedOutputs.reduce((acc, out) => {
      if (out.price === null) return acc;
      return acc + out.price * out.probability;
    }, 0);

    return NextResponse.json({
      mode,
      poolKind,
      requiredItems,
      contractVariant,
      rarity,
      nextRarity,
      avgFloat,
      avgNormalizedFloat,
      outputs: resolvedOutputs.sort((a, b) => b.probability - a.probability),
      expectedValue,
    });
  } catch (error) {
    console.error("Trade-up simulate error:", error);
    return NextResponse.json(
      { error: "Trade-up simulace selhala." },
      { status: 500 }
    );
  }
}
