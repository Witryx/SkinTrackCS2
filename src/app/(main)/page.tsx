import Link from "next/link";
import { getTrendingSkins } from "@/app/lib/skinport";
import { getTrendingSkinsFromDb } from "@/app/lib/skin-database";
import SkinMarketCard from "@/components/SkinMarketCard";

export default async function HomePage() {
  let data:
    | {
        featured: Awaited<ReturnType<typeof getTrendingSkins>>["featured"];
        trending: Awaited<ReturnType<typeof getTrendingSkins>>["trending"];
      }
    | null = null;
  let source: "skinport" | "db" | "none" = "skinport";

  try {
    data = await getTrendingSkins();
  } catch (error) {
    console.error("Trending fetch failed", error);
  }

  if (!data || !data.featured?.length) {
    try {
      const dbData = await getTrendingSkinsFromDb();
      data = dbData;
      source = dbData.featured.length ? "db" : "none";
    } catch (error) {
      console.error("Trending DB fallback failed", error);
      source = "none";
    }
  }

  const highlight = data?.featured?.[0] ?? null;
  const badgeText =
    source === "skinport" ? "Live Skinport" : source === "db" ? "DB cache" : "Offline";

  return (
    <section className="container-max py-10 space-y-10">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-8 space-y-5">
          <span className="badge">{badgeText}</span>
          <h1 className="display text-4xl sm:text-5xl">SkinTrack CS2</h1>
          <p className="text-[color:var(--muted)] text-base">
            Sleduj trendy, ceny a likviditu CS2 skinu v jednom prehlednem dashboardu.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/explorer" className="btn-primary">
              Otevrit Explorer
            </Link>
            <a href="#trendy" className="btn-ghost">
              Zobrazit trendy
            </a>
          </div>
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="kicker">Highlight tydne</div>
            <span className="text-xs text-[color:var(--muted)]">Sales/history</span>
          </div>

          {!highlight && (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6 text-sm text-[color:var(--muted)]">
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
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">Top 3 itemy tydne</h2>
          <span className="text-sm text-[color:var(--muted)]">Sales/history</span>
        </div>
        {!data && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--muted)]">
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
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">Trendy skiny (dalsi 30 podle objemu 7d)</h2>
          <a href="/explorer" className="text-sm text-[color:var(--accent-2)] hover:underline">
            Rozsirene hledani
          </a>
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
