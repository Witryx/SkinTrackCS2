import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkinDetailLocal } from "@/app/lib/skin-catalog";
import {
  getSkinFromDb,
  getSkinPriceHistory,
  recordShopPriceHistory,
  recordSkinPriceHistory,
  upsertSkinFromSkinportName,
} from "@/app/lib/skin-database";
import { getSkinImageUrl } from "@/app/lib/skin-images";
import { rarityBgClass } from "@/app/lib/rarity";
import { getShopPrices, type ShopPrice } from "@/app/lib/shop-prices";
import { getSkinByName } from "@/app/lib/skinport";
import PriceHistoryChart from "@/components/PriceHistoryChart";

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString("cs-CZ") : "-";

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

function ShopPricesFallback() {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="kicker">Porovnani shopu</div>
          <h3 className="text-xl font-semibold">Ceny na trzistich</h3>
        </div>
        <span className="text-xs text-[color:var(--muted)]">nacitam...</span>
      </div>
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6 text-sm text-[color:var(--muted)]">
        Nacitam live ceny z marketu...
      </div>
    </div>
  );
}

function PriceHistoryFallback() {
  return (
    <div className="card p-6">
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-12 text-center text-sm text-[color:var(--muted)]">
        Nacitam cenovy graf...
      </div>
    </div>
  );
}

async function PriceHistorySection({ historyName }: { historyName: string }) {
  const history = await getSkinPriceHistory(historyName, 90).catch(() => ({
    points: [],
    currency: "EUR",
  }));

  return (
    <div className="card p-6">
      <PriceHistoryChart points={history.points} currency={history.currency} />
    </div>
  );
}

async function ShopPricesSection({ historyName }: { historyName: string }) {
  const shopPrices = await getShopPrices(historyName).catch(() => []);
  const sortedShopPrices = sortShopPrices(shopPrices);

  if (shopPrices.length > 0) {
    void recordShopPriceHistory(historyName, shopPrices).catch((error) => {
      console.error("recordShopPriceHistory background sync failed", error);
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="kicker">Porovnani shopu</div>
          <h3 className="text-xl font-semibold">Ceny na trzistich</h3>
        </div>
        <span className="text-xs text-[color:var(--muted)]">live</span>
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
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm"
            >
              <div className="font-semibold">{shop.label}</div>
              <div className="text-lg font-semibold">
                {shop.price !== null
                  ? new Intl.NumberFormat("cs-CZ", {
                      style: "currency",
                      currency: shop.currency,
                      maximumFractionDigits: 2,
                    }).format(shop.price)
                  : "-"}
              </div>
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
  );
}

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
  const skinportData =
    dbData || localData
      ? null
      : await withTimeout(getSkinByName(decodedName).catch(() => null), 2500, null);
  const data = dbData ?? localData ?? skinportData;

  if (!data) {
    notFound();
  }

  const historyName = data.name;

  if (skinportData) {
    void upsertSkinFromSkinportName(decodedName).catch((error) => {
      console.error("upsertSkinFromSkinportName background sync failed", error);
    });
  }

  void recordSkinPriceHistory(historyName).catch((error) => {
    console.error("recordSkinPriceHistory background sync failed", error);
  });

  const imageUrl = getSkinImageUrl(data.name);
  const sourceBadge = skinportData
    ? "Skinport live"
    : dbData
      ? "DB cache"
      : "Offline katalog";
  const marketUrl = data.marketPage || data.itemPage || null;
  const isSkinport = marketUrl?.includes("skinport.com") ?? false;
  const primaryMarketLabel = isSkinport ? "Otevrit Skinport market" : "Otevrit market";
  const secondaryMarketLabel = isSkinport ? "Detail na Skinportu" : "Detail na marketu";

  return (
    <section className="container-max py-8 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/explorer"
          className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          &larr; Zpet do Exploreru
        </Link>
        <span className="badge">{sourceBadge}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="card p-6 flex items-center justify-center bg-gradient-to-br from-[color:var(--card)] to-[color:var(--card-solid)]">
          <img
            src={imageUrl}
            alt={data.name}
            className="max-h-96 w-full object-contain drop-shadow-2xl"
            loading="lazy"
          />
        </div>

        <div className="card p-6 flex flex-col gap-5">
          <div className="space-y-2">
            <div className="kicker">{data.weapon}</div>
            <h1 className="display text-3xl font-semibold leading-tight">{data.skin}</h1>
            {data.wear && (
              <div className="text-sm text-[color:var(--muted)]">{data.wear}</div>
            )}
            <div className="text-xs text-[color:var(--muted)]">{data.name}</div>
            {data.rarity && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1 text-xs font-semibold text-[color:var(--fg)]">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    rarityBgClass[data.rarity as keyof typeof rarityBgClass] ?? "bg-white/60"
                  }`}
                />
                {data.rarity}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <div className="text-[color:var(--muted)]">Aktualni cena</div>
              <div className="text-2xl font-semibold">
                {data.price ? currency.format(data.price) : "-"}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Rozpeti: {data.minPrice ? currency.format(data.minPrice) : "-"} -{" "}
                {data.maxPrice ? currency.format(data.maxPrice) : "-"}
              </div>
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <div className="text-[color:var(--muted)]">Median 7d</div>
              <div className="text-xl font-semibold">
                {data.median7d ? currency.format(data.median7d) : "-"}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Suggested: {data.suggestedPrice ? currency.format(data.suggestedPrice) : "-"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {data.marketPage && (
              <a
                href={data.marketPage}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                {primaryMarketLabel}
              </a>
            )}
            {data.itemPage && (
              <a
                href={data.itemPage}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                {secondaryMarketLabel}
              </a>
            )}
          </div>
        </div>
      </div>

      <Suspense fallback={<PriceHistoryFallback />}>
        <PriceHistorySection historyName={historyName} />
      </Suspense>

      <Suspense fallback={<ShopPricesFallback />}>
        <ShopPricesSection historyName={historyName} />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4 text-sm">
          <div className="text-[color:var(--muted)]">Objem 7d</div>
          <div className="text-lg font-semibold">{formatNumber(data.volume7d)}</div>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-[color:var(--muted)]">Skladem</div>
          <div className="text-lg font-semibold">{formatNumber(data.quantity)}</div>
          <div className="text-xs text-[color:var(--muted)]">
            Mean cena: {data.meanPrice ? currency.format(data.meanPrice) : "-"}
          </div>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-[color:var(--muted)]">Median Skinport</div>
          <div className="text-lg font-semibold">
            {data.medianPrice ? currency.format(data.medianPrice) : "-"}
          </div>
        </div>
      </div>
    </section>
  );
}
