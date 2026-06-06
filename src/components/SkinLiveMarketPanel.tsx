"use client";

import { useEffect, useMemo, useState } from "react";
import SmoothScrollButton from "@/components/SmoothScrollButton";
import WishlistButton from "@/components/WishlistButton";

type ShopPrice = {
  id: string;
  label: string;
  price: number | null;
  currency: string;
  originalPrice?: number | null;
  originalCurrency?: string | null;
  url?: string;
  note?: string;
};

type Props = {
  marketHashName: string;
  initialPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  median7d?: number | null;
  suggestedPrice?: number | null;
  itemPage?: string | null;
  marketPage?: string | null;
  mode?: "all" | "summary" | "offers";
};

type ShopPriceCacheEntry = {
  data?: ShopPrice[];
  promise?: Promise<ShopPrice[]>;
};

const shopPriceCache = new Map<string, ShopPriceCacheEntry>();

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

const sortShopPrices = (shopPrices: ShopPrice[]) =>
  [...shopPrices].sort((a, b) => {
    if (a.price === null && b.price === null) {
      return a.label.localeCompare(b.label);
    }
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

const fetchShopPrices = (marketHashName: string) => {
  const cacheKey = marketHashName.trim().toLowerCase();
  const cached = shopPriceCache.get(cacheKey);
  if (cached?.data) return Promise.resolve(cached.data);
  if (cached?.promise) return cached.promise;

  const promise = fetch(
    `/api/skins/shop-prices?${new URLSearchParams({
      name: marketHashName,
    }).toString()}`,
    { cache: "no-store" }
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("Shop prices failed");
      return response.json();
    })
    .then((body) => {
      const nextPrices = Array.isArray(body?.shopPrices)
        ? sortShopPrices(body.shopPrices)
        : [];
      shopPriceCache.set(cacheKey, { data: nextPrices });
      window.dispatchEvent(
        new CustomEvent("skintrack:price-history-updated", {
          detail: { marketHashName },
        })
      );
      return nextPrices;
    })
    .catch((error) => {
      shopPriceCache.delete(cacheKey);
      throw error;
    });

  shopPriceCache.set(cacheKey, { promise });
  return promise;
};

const useShopPrices = (marketHashName: string) => {
  const [shopPrices, setShopPrices] = useState<ShopPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = marketHashName.trim().toLowerCase();
    const cached = shopPriceCache.get(cacheKey);

    if (cached?.data) {
      setShopPrices(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetchShopPrices(marketHashName)
      .then((nextPrices) => {
        if (cancelled) return;
        setShopPrices(nextPrices);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        console.error("Shop prices client fetch failed", fetchError);
        setError("Live ceny se nepodarilo nacist.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [marketHashName]);

  return { shopPrices, loading, error };
};

export default function SkinLiveMarketPanel({
  marketHashName,
  initialPrice,
  minPrice,
  maxPrice,
  median7d,
  suggestedPrice,
  itemPage,
  marketPage,
  mode = "all",
}: Props) {
  const { shopPrices, loading, error } = useShopPrices(marketHashName);
  const bestLiveShop = useMemo(
    () =>
      shopPrices.find(
        (shop): shop is ShopPrice & { price: number } =>
          typeof shop.price === "number" && Number.isFinite(shop.price)
      ) ?? null,
    [shopPrices]
  );

  const headlinePrice = bestLiveShop?.price ?? initialPrice ?? null;
  const headlinePriceLabel = bestLiveShop
    ? `Nejlevnejsi live (${bestLiveShop.label})`
    : loading
      ? "Nacitam live cenu"
      : "Aktualni cena";
  const cheapestOfferUrl = bestLiveShop?.url ?? marketPage ?? itemPage ?? null;
  const isSkinport = itemPage?.includes("skinport.com") ?? false;

  const summary = (
    <>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="stat-tile">
          <div className="text-[color:var(--muted)]">{headlinePriceLabel}</div>
          <div className="text-3xl font-black">
            {formatMoney(headlinePrice)}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {bestLiveShop
              ? `Snapshot marketu: ${bestLiveShop.label}`
              : `Skinport rozpeti: ${formatMoney(minPrice)} - ${formatMoney(
                  maxPrice
                )}`}
          </div>
        </div>
        <div className="stat-tile">
          <div className="text-[color:var(--muted)]">Median 7d</div>
          <div className="text-2xl font-black">
            {formatMoney(median7d)}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            Suggested: {formatMoney(suggestedPrice)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <WishlistButton marketHashName={marketHashName} />
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
        {itemPage && (
          <a
            href={itemPage}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            {isSkinport ? "Detail na Skinportu" : "Detail na marketu"}
          </a>
        )}
      </div>
    </>
  );

  const offers = (
    <div id="shop-offers" className="scroll-mt-24 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="kicker">Porovnani shopu</div>
          <h3 className="text-xl font-semibold">Ceny na trzistich</h3>
        </div>
        <span className="text-xs text-[color:var(--muted)]">
          {loading ? "nacitam..." : "live / EUR"}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6 text-sm text-[color:var(--muted)]">
          Nacitam live ceny z marketu...
        </div>
      )}

      {!loading && !shopPrices.length && (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6 text-sm text-[color:var(--muted)]">
          Ceny se nepodarilo nacist.
        </div>
      )}

      {!!shopPrices.length && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shopPrices.map((shop) => (
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
                    puvodne{" "}
                    {formatShopMoney(shop.originalPrice, shop.originalCurrency)}
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
  );

  if (mode === "summary") return summary;
  if (mode === "offers") return offers;

  return (
    <>
      {summary}
      {offers}
    </>
  );
}
