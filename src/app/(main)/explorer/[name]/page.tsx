import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkinDetailLocal } from "@/app/lib/skin-catalog";
import {
  getSkinFromDb,
  getSkinPriceHistory,
  isPriceSnapshotStale,
  recordShopPriceHistory,
  upsertSkinFromSkinportName,
} from "@/app/lib/skin-database";
import { getSkinImageUrl } from "@/app/lib/skin-images";
import { rarityBgClass } from "@/app/lib/rarity";
import { getShopPrices, type ShopPrice } from "@/app/lib/shop-prices";
import { getSkinByName } from "@/app/lib/skinport";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import SmoothScrollButton from "@/components/SmoothScrollButton";
import SkinWearPanel from "@/components/SkinWearPanel";
import WishlistButton from "@/components/WishlistButton";

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatMoney = (value: number | null | undefined) =>
  typeof value === "number" ? currency.format(value) : "-";

const formatShopMoney = (
  value: number | null | undefined,
  currencyCode: string
) =>
  typeof value === "number"
    ? new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(value)
    : "-";

type PageProps = {
  params: { name: string };
};

const sortShopPrices = (shopPrices: ShopPrice[]) =>
  [...shopPrices].sort((a, b) => {
    if (a.price === null && b.price === null) {
      return a.label.localeCompare(b.label);
    }
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T) => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
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
    getSkinFromDb(decodedName),
    getSkinDetailLocal(decodedName).catch(() => null),
  ]);
  const shouldFetchLive = !dbData || isPriceSnapshotStale(dbData.updatedAt);
  const skinportData = shouldFetchLive
    ? await withTimeout(getSkinByName(decodedName).catch(() => null), 2500, null)
    : null;
  const resolvedData = skinportData ?? dbData ?? localData;

  if (!resolvedData) {
    notFound();
  }

  const historyName = resolvedData.name;
  const sortedShopPrices = await withTimeout(
    (async () => {
      const shopPrices = await getShopPrices(historyName).catch(() => []);
      if (shopPrices.length > 0) {
        await recordShopPriceHistory(historyName, shopPrices).catch((error) => {
          console.error("recordShopPriceHistory sync failed", error);
        });
      }
      return sortShopPrices(shopPrices);
    })(),
    4500,
    [] as ShopPrice[]
  );
  const history = await getSkinPriceHistory(historyName, 90).catch(() => ({
    points: [],
    currency: "EUR",
  }));
  const bestLiveShop =
    sortedShopPrices.find(
      (shop): shop is ShopPrice & { price: number } =>
        typeof shop.price === "number" && Number.isFinite(shop.price)
    ) ?? null;

  if (skinportData) {
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
  const marketUrl = resolvedData.marketPage || resolvedData.itemPage || null;
  const isSkinport = marketUrl?.includes("skinport.com") ?? false;
  const headlinePrice = bestLiveShop?.price ?? resolvedData.price;
  const headlinePriceLabel = bestLiveShop
    ? `Nejlevnejsi live (${bestLiveShop.label})`
    : "Aktualni cena";
  const cheapestOfferUrl =
    bestLiveShop?.url ?? resolvedData.marketPage ?? resolvedData.itemPage ?? null;

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

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="stat-tile">
              <div className="text-[color:var(--muted)]">{headlinePriceLabel}</div>
              <div className="text-3xl font-black">
                {formatMoney(headlinePrice)}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                {bestLiveShop
                  ? `Snapshot marketu: ${bestLiveShop.label}`
                  : `Skinport rozpeti: ${formatMoney(resolvedData.minPrice)} - ${formatMoney(
                      resolvedData.maxPrice
                    )}`}
              </div>
            </div>
            <div className="stat-tile">
              <div className="text-[color:var(--muted)]">Median 7d</div>
              <div className="text-2xl font-black">
                {formatMoney(resolvedData.median7d)}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Suggested: {formatMoney(resolvedData.suggestedPrice)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <WishlistButton marketHashName={resolvedData.name} />
            {cheapestOfferUrl && (
              <a
                href={cheapestOfferUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                Otevrit nejlevnejsi nabidku
              </a>
            )}
            <SmoothScrollButton targetId="shop-offers" className="btn-ghost">
              Zobrazit dalsi nabidky
            </SmoothScrollButton>
            {resolvedData.itemPage && (
              <a
                href={resolvedData.itemPage}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                {isSkinport ? "Detail na Skinportu" : "Detail na marketu"}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <PriceHistoryChart points={history.points} currency={history.currency} />
      </div>

      <div id="shop-offers" className="card scroll-mt-24 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="kicker">Porovnani shopu</div>
            <h3 className="text-xl font-semibold">Ceny na trzistich</h3>
          </div>
          <span className="text-xs text-[color:var(--muted)]">live / EUR</span>
        </div>

        {!sortedShopPrices.length && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6 text-sm text-[color:var(--muted)]">
            Ceny se nepodarilo nacist.
          </div>
        )}

        {!!sortedShopPrices.length && (
          <div className="grid gap-3 md:grid-cols-3">
            {sortedShopPrices.map((shop) => (
              <div
                key={shop.id}
                className={`rounded-xl border bg-[color:var(--surface-soft)] p-4 text-sm ${
                  bestLiveShop?.id === shop.id
                    ? "border-[color:var(--accent-2)]"
                    : "border-[color:var(--border)]"
                }`}
              >
                <div className="font-bold">{shop.label}</div>
                <div className="text-2xl font-black">
                  {formatShopMoney(shop.price, shop.currency)}
                </div>
                {shop.originalPrice !== null &&
                  shop.originalPrice !== undefined &&
                  shop.originalCurrency &&
                  shop.originalCurrency !== shop.currency && (
                    <div className="text-xs text-[color:var(--muted)]">
                      puvodne {formatShopMoney(shop.originalPrice, shop.originalCurrency)}
                    </div>
                  )}
                {shop.note && (
                  <div className="text-xs text-[color:var(--muted)]">
                    {shop.note}
                  </div>
                )}
                {shop.url && (
                  <a
                    href={shop.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-[color:var(--accent-2)] hover:underline"
                  >
                    Otevrit shop
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
