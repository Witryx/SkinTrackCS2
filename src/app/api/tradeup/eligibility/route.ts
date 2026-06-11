import { NextRequest, NextResponse } from "next/server";
import {
  getSkinMetaMap,
  normalizeMarketHashForMeta,
  type SkinMeta,
} from "@/app/lib/skin-meta";
import { isWeaponInSkinCategory } from "@/app/lib/skin-categories";

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

const getItemVariant = (name: string): ItemVariant => {
  if (/^\s*souvenir\s+/i.test(name)) return "souvenir";
  if (/^\s*stattrak\S*\s+/i.test(name)) return "stattrak";
  return "regular";
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
      null
    );
  }
  return pools[0] ?? null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const names: string[] = Array.isArray(body?.names)
    ? Array.from(
        new Set(
          body.names
            .map((name: unknown) => (typeof name === "string" ? name.trim() : ""))
            .filter(Boolean)
        )
      ).slice(0, 2000) as string[]
    : [];
  const mode: SimMode = body?.mode === "knife" ? "knife" : "standard";

  if (!names.length) {
    return NextResponse.json({ eligibility: {} });
  }

  try {
    const metaMap = await getSkinMetaMap();
    const allMeta = Array.from(new Set(metaMap.values()));
    const standardOutputIndex = new Map<string, Map<string, number>>();
    const specialOutputIndex = new Map<string, { knives: number; gloves: number }>();

    for (const meta of allMeta) {
      const specialKind = getSpecialKind(meta);

      if (specialKind) {
        for (const pool of getTradeupPools(meta, "knife")) {
          const current = specialOutputIndex.get(pool) ?? { knives: 0, gloves: 0 };
          if (specialKind === "knife") current.knives += 1;
          if (specialKind === "gloves") current.gloves += 1;
          specialOutputIndex.set(pool, current);
        }
        continue;
      }

      if (!meta.rarity) continue;
      for (const pool of getTradeupPools(meta, "standard")) {
        const byRarity = standardOutputIndex.get(pool) ?? new Map<string, number>();
        byRarity.set(meta.rarity, (byRarity.get(meta.rarity) ?? 0) + 1);
        standardOutputIndex.set(pool, byRarity);
      }
    }

    const eligibility = names.reduce<
      Record<
        string,
        {
          canOutput: boolean;
          reason: string | null;
          pool: string | null;
          outputCount: number;
        }
      >
    >((acc, name) => {
      const meta = metaMap.get(normalizeMarketHashForMeta(name)) ?? null;
      const variant = getItemVariant(name);
      const pool = getPrimaryTradeupPool(meta, mode);

      if (!meta) {
        acc[name] = {
          canOutput: false,
          reason: "Skin není v meta databázi.",
          pool,
          outputCount: 0,
        };
        return acc;
      }

      if (variant === "souvenir") {
        acc[name] = {
          canOutput: false,
          reason: "Souvenir skiny nejdou použít v Trade Up Contractu.",
          pool,
          outputCount: 0,
        };
        return acc;
      }

      if (getSpecialKind(meta)) {
        acc[name] = {
          canOutput: false,
          reason: "Nože a rukavice nejdou použít jako input.",
          pool,
          outputCount: 0,
        };
        return acc;
      }

      if (!pool) {
        acc[name] = {
          canOutput: false,
          reason:
            mode === "knife"
              ? "Skin nemá rozpoznaný case pool."
              : "Skin nemá rozpoznanou collection.",
          pool,
          outputCount: 0,
        };
        return acc;
      }

      if (mode === "knife") {
        const outputCounts = specialOutputIndex.get(pool);
        const outputCount =
          variant === "stattrak"
            ? outputCounts?.knives ?? 0
            : (outputCounts?.knives ?? 0) + (outputCounts?.gloves ?? 0);

        acc[name] = {
          canOutput: outputCount > 0,
          reason:
            outputCount > 0
              ? null
              : variant === "stattrak"
                ? `Case pool "${pool}" nemá StatTrak nože jako output.`
                : `Case pool "${pool}" nemá žádné gold outputy.`,
          pool,
          outputCount,
        };
        return acc;
      }

      const rarityIndex = rarityOrder.indexOf(
        meta.rarity as (typeof rarityOrder)[number]
      );
      const nextRarity =
        rarityIndex >= 0 && rarityIndex < rarityOrder.length - 1
          ? rarityOrder[rarityIndex + 1]
          : null;
      const outputCount = nextRarity
        ? standardOutputIndex.get(pool)?.get(nextRarity) ?? 0
        : 0;

      acc[name] = {
        canOutput: outputCount > 0,
        reason:
          outputCount > 0
            ? null
            : nextRarity
              ? `Collection "${pool}" nemá outputy rarity ${nextRarity}.`
              : "Pro tuto raritu není další standardní output.",
        pool,
        outputCount,
      };
      return acc;
    }, {});

    return NextResponse.json({ eligibility });
  } catch (error) {
    console.error("Trade-up eligibility failed", error);
    return NextResponse.json(
      { eligibility: {}, error: "Eligibility check failed." },
      { status: 200 }
    );
  }
}
