import Link from "next/link";
import { notFound } from "next/navigation";
import { withTimeout } from "@/app/lib/async-timeout";
import { getSkinDetailLocal } from "@/app/lib/skin-catalog";
import {
  getSkinFromDb,
  getSkinPriceHistory,
  isPriceSnapshotStale,
  upsertSkinFromSkinportName,
} from "@/app/lib/skin-database";
import { getSkinImageUrl } from "@/app/lib/skin-images";
import { rarityBgClass } from "@/app/lib/rarity";
import { getSkinByName } from "@/app/lib/skinport";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import SkinLiveMarketPanel from "@/components/SkinLiveMarketPanel";
import SkinWearPanel from "@/components/SkinWearPanel";

type PageProps = {
  params: { name: string };
};

export async function generateMetadata({ params }: PageProps) {
  const decodedName = decodeURIComponent(params.name);
  return {
    title: `${decodedName} | SkinTrack CS2`,
  };
}

export const dynamic = "force-dynamic";

export default async function SkinDetailPage({ params }: PageProps) {
  const decodedName = decodeURIComponent(params.name);
  const [dbData, localData] = await Promise.all([
    withTimeout(getSkinFromDb(decodedName), 3500, null),
    getSkinDetailLocal(decodedName).catch(() => null),
  ]);
  const shouldFetchLive = !dbData && !localData;
  const skinportData = shouldFetchLive
    ? await withTimeout(getSkinByName(decodedName), 1200, null)
    : null;
  const resolvedData = skinportData ?? dbData ?? localData;

  if (!resolvedData) {
    notFound();
  }

  const historyName = resolvedData.name;
  const history = await withTimeout(getSkinPriceHistory(historyName, 90), 3500, {
    points: [],
    currency: "EUR",
  });

  if (skinportData || (dbData && isPriceSnapshotStale(dbData.updatedAt))) {
    void upsertSkinFromSkinportName(decodedName).catch((error) => {
      console.error("live price sync failed", error);
    });
  }

  const imageUrl = getSkinImageUrl(resolvedData.name);
  const sourceBadge = skinportData
    ? dbData
      ? "Skinport refresh"
      : "Skinport live"
    : dbData
      ? "DB cache"
      : "Offline katalog";

  return (
    <section className="container-max space-y-8 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/explorer"
          className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          <span aria-hidden="true">&larr;</span>
          Zpet do Exploreru
        </Link>
        <span className="badge">{sourceBadge}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="market-stage flex min-h-[28rem] items-center justify-center p-6">
            <img
              src={imageUrl}
              alt={resolvedData.name}
              className="max-h-96 w-full object-contain drop-shadow-2xl"
              loading="lazy"
            />
          </div>

          <SkinWearPanel
            wear={resolvedData.wear}
            minFloat={resolvedData.minFloat}
            maxFloat={resolvedData.maxFloat}
          />
        </div>

        <div className="card flex flex-col gap-5 p-6">
          <div className="space-y-2">
            <div className="kicker">{resolvedData.weapon}</div>
            <h1 className="display text-4xl leading-tight">{resolvedData.skin}</h1>
            {resolvedData.wear && (
              <div className="text-sm text-[color:var(--muted)]">{resolvedData.wear}</div>
            )}
            <div className="text-xs text-[color:var(--muted)]">{resolvedData.name}</div>
            {resolvedData.rarity && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1 text-xs font-semibold text-[color:var(--fg)]">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    rarityBgClass[
                      resolvedData.rarity as keyof typeof rarityBgClass
                    ] ?? "bg-white/60"
                  }`}
                />
                {resolvedData.rarity}
              </div>
            )}
          </div>

          <SkinLiveMarketPanel
            marketHashName={resolvedData.name}
            initialPrice={resolvedData.price}
            minPrice={resolvedData.minPrice}
            maxPrice={resolvedData.maxPrice}
            median7d={resolvedData.median7d}
            suggestedPrice={resolvedData.suggestedPrice}
            itemPage={resolvedData.itemPage}
            marketPage={resolvedData.marketPage}
            mode="summary"
          />
        </div>
      </div>

      <div className="card p-6">
        <SkinLiveMarketPanel
          marketHashName={resolvedData.name}
          mode="offers"
        />
      </div>

      <div className="card p-6">
        <PriceHistoryChart
          points={history.points}
          currency={history.currency}
          marketHashName={historyName}
        />
      </div>

    </section>
  );
}
