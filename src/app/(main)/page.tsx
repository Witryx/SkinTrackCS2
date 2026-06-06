import Link from "next/link";
import { withTimeout } from "@/app/lib/async-timeout";
import { searchSkinsLocal } from "@/app/lib/skin-catalog";
import { getTrendingSkinsFromDb } from "@/app/lib/skin-database";
import { getSkinImageUrl } from "@/app/lib/skin-images";
import SkinMarketCard from "@/components/SkinMarketCard";

export const dynamic = "force-dynamic";

type TrendingData = Awaited<ReturnType<typeof getTrendingSkinsFromDb>>;

async function getTrendingSkinsFromLocalCatalog(): Promise<TrendingData> {
  const items = await searchSkinsLocal({ limit: 33, sort: "volume" });
  const mapped = items.map((item) => ({
    name: item.name,
    weapon: item.weapon,
    skin: item.skin,
    wear: item.wear ?? null,
    price: item.price ?? null,
    volume7d: item.volume7d ?? null,
    median7d: item.median7d ?? null,
    quantity: item.quantity ?? null,
    rarity: item.rarity,
    itemPage: item.itemPage ?? undefined,
    marketPage: item.marketPage ?? undefined,
  }));

  return {
    featured: mapped.slice(0, 3),
    trending: mapped.slice(3, 33),
  };
}

export default async function HomePage() {
  let data: TrendingData | null = null;
  let source: "db" | "local" | "none" = "db";

  const dbData = await withTimeout(getTrendingSkinsFromDb(), 250, null);
  if (dbData?.featured.length) {
    data = dbData;
  }

  if (!data || !data.featured?.length) {
    try {
      data = await getTrendingSkinsFromLocalCatalog();
      source = data.featured.length ? "local" : "none";
    } catch (error) {
      console.error("Trending local fallback failed", error);
      source = "none";
    }
  }

  const highlight = data?.featured?.[0] ?? null;
  const badgeText =
    source === "db" ? "DB cache" : source === "local" ? "Offline katalog" : "Offline";
  const visibleItems = [...(data?.featured ?? []), ...(data?.trending ?? [])];
  const pricedItems = visibleItems.filter((item) => typeof item.price === "number");
  const totalVolume = visibleItems.reduce(
    (sum, item) => sum + (typeof item.volume7d === "number" ? item.volume7d : 0),
    0
  );
  const bestPrice =
    pricedItems.length > 0
      ? Math.min(...pricedItems.map((item) => item.price ?? Number.POSITIVE_INFINITY))
      : null;
  const currency = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });

  return (
    <section className="container-max space-y-10 py-8 sm:py-10">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="market-stage overflow-hidden p-6 sm:p-8">
          <div className="grid min-h-[25rem] gap-6 lg:grid-cols-[1fr_21rem] lg:items-end">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <span className="badge">{badgeText}</span>
                <div className="max-w-2xl space-y-4">
                  <h1 className="display text-4xl leading-none sm:text-6xl">
                    SkinTrack CS2
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
                    Moderni dashboard pro ceny, trendy a wishlist CS2 skinu.
                    Rychle najdes skin, porovnas nabidky a uvidis, co se na trhu hybe.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/explorer" className="btn-primary">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m16.5 16.5 4 4" />
                    </svg>
                    Otevrit Explorer
                  </Link>
                  <a href="#trendy" className="btn-ghost">
                    Zobrazit trendy
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="stat-tile">
                  <div className="text-xs text-[color:var(--muted)]">Monitorovano</div>
                  <div className="mt-1 text-2xl font-black">{visibleItems.length}</div>
                </div>
                <div className="stat-tile">
                  <div className="text-xs text-[color:var(--muted)]">Objem 7d</div>
                  <div className="mt-1 text-2xl font-black">
                    {totalVolume.toLocaleString("cs-CZ")}
                  </div>
                </div>
                <div className="stat-tile">
                  <div className="text-xs text-[color:var(--muted)]">Od ceny</div>
                  <div className="mt-1 text-2xl font-black">
                    {bestPrice !== null ? currency.format(bestPrice) : "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative hidden min-h-[23rem] lg:block">
              {highlight && (
                <>
                  <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow)]">
                    <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                      <span>Highlight tydne</span>
                      <span>{highlight.volume7d?.toLocaleString("cs-CZ") ?? "-"} sales</span>
                    </div>
                    <div className="text-2xl font-black leading-tight">{highlight.weapon}</div>
                    <div className="text-lg font-semibold text-[color:var(--muted-strong)]">
                      {highlight.skin}
                    </div>
                    <div className="mt-4 text-3xl font-black">
                      {typeof highlight.price === "number" ? currency.format(highlight.price) : "-"}
                    </div>
                  </div>
                  <img
                    src={getSkinImageUrl(highlight.name)}
                    alt={highlight.name}
                    className="absolute left-1/2 top-3 h-56 w-full -translate-x-1/2 object-contain drop-shadow-[0_24px_36px_rgba(0,0,0,0.35)]"
                    loading="lazy"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="kicker">Live highlight</div>
              <h2 className="mt-1 text-xl font-black">Nejvyraznejsi skin</h2>
            </div>
            <span className="text-xs text-[color:var(--muted)]">Sales/history</span>
          </div>

          {!highlight && (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-6 text-sm text-[color:var(--muted)]">
              Nepodarilo se nacist data ze Skinport API.
            </div>
          )}

          {highlight && (
            <SkinMarketCard
              name={highlight.name}
              weapon={highlight.weapon}
              skin={highlight.skin}
              wear={highlight.wear}
              rarity={highlight.rarity ?? null}
              price={highlight.price}
              volume7d={highlight.volume7d}
              median7d={highlight.median7d}
              quantity={highlight.quantity}
              itemPage={highlight.itemPage}
              marketPage={highlight.marketPage}
              density="compact"
            />
          )}
        </div>
      </div>

      <div className="space-y-4" id="trendy">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kicker">Trending</div>
            <h2 className="display text-3xl">Top 3 itemy tydne</h2>
          </div>
          <span className="text-sm text-[color:var(--muted)]">Sales/history</span>
        </div>
        {!data && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Nepodarilo se nacist trendy z Skinport API.
          </div>
        )}
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.featured.map((item) => (
              <SkinMarketCard
                key={item.name}
                name={item.name}
                weapon={item.weapon}
                skin={item.skin}
                wear={item.wear}
                rarity={item.rarity ?? null}
                price={item.price}
                volume7d={item.volume7d}
                median7d={item.median7d}
                quantity={item.quantity}
                itemPage={item.itemPage}
                marketPage={item.marketPage}
                density="compact"
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kicker">Market watchlist</div>
            <h2 className="display text-3xl">Dalsi trendy skiny</h2>
          </div>
          <Link href="/explorer" className="text-sm font-semibold text-[color:var(--accent)] hover:underline">
            Rozsirene hledani
          </Link>
        </div>
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {data.trending.map((item) => (
              <SkinMarketCard
                key={item.name}
                name={item.name}
                weapon={item.weapon}
                skin={item.skin}
                wear={item.wear}
                rarity={item.rarity ?? null}
                price={item.price}
                volume7d={item.volume7d}
                median7d={item.median7d}
                quantity={item.quantity}
                itemPage={item.itemPage}
                marketPage={item.marketPage}
                density="compact"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
