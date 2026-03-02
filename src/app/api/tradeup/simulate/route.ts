import { NextRequest, NextResponse } from "next/server";
import {
  getSkinMetaMap,
  normalizeMarketHashForMeta,
  SkinMeta,
} from "@/app/lib/skin-meta";
import { getSkinportItems, SkinportItem } from "@/app/lib/skinport";

type InputItem = {
  name: string;
  float?: number | null;
};

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

const priceFromItem = (item?: SkinportItem | null) => {
  if (!item) return null;
  return item.min_price ?? item.median_price ?? item.suggested_price ?? null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const items: InputItem[] = Array.isArray(body?.items) ? body.items : [];

    if (items.length !== 10) {
      return NextResponse.json(
        { error: "Je potreba presne 10 skinu." },
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
      return { item, meta };
    });

    if (resolved.some((entry) => !entry.meta)) {
      return NextResponse.json(
        { error: "Nektere skiny se nepodarilo najit v meta databazi." },
        { status: 400 }
      );
    }

    const rarity = resolved[0]?.meta?.rarity ?? null;
    if (!rarity) {
      return NextResponse.json(
        { error: "Nelze urcit raritu vstupnich skinu." },
        { status: 400 }
      );
    }

    if (resolved.some((entry) => entry.meta?.rarity !== rarity)) {
      return NextResponse.json(
        { error: "Vsechny skiny musi mit stejnou raritu." },
        { status: 400 }
      );
    }

    const rarityIndex = rarityOrder.indexOf(rarity as (typeof rarityOrder)[number]);
    const nextRarity =
      rarityIndex >= 0 && rarityIndex < rarityOrder.length - 1
        ? rarityOrder[rarityIndex + 1]
        : null;

    if (!nextRarity) {
      return NextResponse.json(
        { error: "Pro tuto raritu nelze trade-up vypocitat." },
        { status: 400 }
      );
    }

    const collectionCounts = new Map<string, number>();
    for (const entry of resolved) {
      const containers = entry.meta?.containers ?? [];
      const collection = containers[0] ?? "Unknown";
      collectionCounts.set(collection, (collectionCounts.get(collection) ?? 0) + 1);
    }

    const collectionIndex = new Map<string, SkinMeta[]>();
    for (const meta of byFormatted.values()) {
      if (!meta.containers?.length) continue;
      if (meta.rarity !== nextRarity) continue;
      for (const collection of meta.containers) {
        const list = collectionIndex.get(collection) ?? [];
        list.push(meta);
        collectionIndex.set(collection, list);
      }
    }

    const avgFloat =
      resolved.reduce((acc, entry) => {
        const meta = entry.meta!;
        const provided = typeof entry.item.float === "number" ? entry.item.float : null;
        const fallback =
          meta.minFloat !== null && meta.maxFloat !== null
            ? (meta.minFloat + meta.maxFloat) / 2
            : 0.2;
        return acc + (provided ?? fallback);
      }, 0) / resolved.length;

    const outputs: Array<{
      name: string;
      marketHashName: string;
      probability: number;
      float: number;
      wear: string;
      price: number | null;
      currency: string;
      collection: string;
    }> = [];

    const skinportItems = await getSkinportItems();

    for (const [collection, count] of collectionCounts.entries()) {
      const outcomes = collectionIndex.get(collection) ?? [];
      if (!outcomes.length) continue;
      const perCollectionProbability = count / 10;
      const perItemProbability = perCollectionProbability / outcomes.length;

      for (const meta of outcomes) {
        const min = meta.minFloat ?? 0;
        const max = meta.maxFloat ?? 1;
        const outputFloat = clamp(avgFloat * (max - min) + min, min, max);
        const wear = getWearFromFloat(outputFloat);
        const marketHashName = `${meta.formattedName} (${wear})`;
        const item = skinportItems[marketHashName.toLowerCase()];
        const price = priceFromItem(item);

        outputs.push({
          name: meta.formattedName,
          marketHashName,
          probability: perItemProbability,
          float: outputFloat,
          wear,
          price,
          currency: item?.currency ?? "EUR",
          collection,
        });
      }
    }

    const expectedValue = outputs.reduce((acc, out) => {
      if (out.price === null) return acc;
      return acc + out.price * out.probability;
    }, 0);

    return NextResponse.json({
      rarity,
      nextRarity,
      avgFloat,
      outputs: outputs.sort((a, b) => b.probability - a.probability),
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
