import Link from "next/link";
import { getSkinDetailPath, getSkinImageUrl } from "@/app/lib/skin-images";
import { getTrendingSkins } from "@/app/lib/skinport";

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString("cs-CZ") : "-";

export default async function HomePage() {
  let data:
    | {
        featured: Awaited<ReturnType<typeof getTrendingSkins>>["featured"];
        trending: Awaited<ReturnType<typeof getTrendingSkins>>["trending"];
      }
    | null = null;

  try {
    data = await getTrendingSkins();
  } catch (e) {
    console.error("Trending fetch failed", e);
  }

  return (
    <section className="container-max py-6 space-y-8">
      <div className="card p-6 space-y-3">
        <h1 className="text-2xl font-bold">SkinTrack CS2</h1>
        <p className="text-[color:var(--muted)]">
          Projekt pro sledování skinů.
        </p>
        <a
          href="/explorer"
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition"
        >
          Otevrit Explorer
        </a>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Top 3 itemy tydne</h2>
          <span className="text-sm text-white/60">Sales/history</span>
        </div>
        {!data && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Nepodarilo se nacist trendy z Skinport API.
          </div>
        )}
        {data && (
          <div className="grid gap-4 sm:grid-cols-3">
            {data.featured.map((item) => (
              <article
                key={item.name}
                className="card p-4 flex flex-col gap-4 border border-white/10"
              >
                <div className="flex items-start gap-3">
                  <div className="h-20 w-24 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    <img
                      src={getSkinImageUrl(item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-20 w-full object-contain drop-shadow-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <Link
                      href={getSkinDetailPath(item.name)}
                      className="text-lg font-semibold leading-tight hover:text-sky-200 transition-colors"
                    >
                      {item.skin}
                    </Link>
                    <div className="text-xs text-white/60">{item.weapon}</div>
                    {item.wear && <div className="text-xs text-white/60">{item.wear}</div>}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/60">
                    Objem 7d: {formatNumber(item.volume7d)}
                    <br />
                    Median 7d: {item.median7d ? currency.format(item.median7d) : "-"}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">od</div>
                    <div className="text-xl font-bold">
                      {item.price ? currency.format(item.price) : "-"}
                    </div>
                    <div className="text-xs text-white/60">
                      Skladem: {formatNumber(item.quantity)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2 text-sm text-sky-300">
                  <Link
                    href={getSkinDetailPath(item.name)}
                    className="hover:underline font-semibold"
                  >
                    Otevrit detail
                  </Link>
                  <a
                    href={item.marketPage || item.itemPage}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    Skinport
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Trendy skiny (dalsi 30 podle objemu 7d)</h2>
          <a href="/explorer" className="text-sm text-sky-300 hover:underline">
            Rozsirene hledani
          </a>
        </div>
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.trending.map((item) => (
              <article
                key={item.name}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3 hover:border-sky-500/60 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="h-16 w-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    <img
                      src={getSkinImageUrl(item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-16 w-full object-contain drop-shadow"
                    />
                  </div>
                  <div className="flex-1">
                    <Link
                      href={getSkinDetailPath(item.name)}
                      className="font-semibold leading-tight hover:text-sky-200 transition-colors"
                    >
                      {item.skin}
                    </Link>
                    <div className="text-xs text-white/60">{item.weapon}</div>
                    {item.wear && <div className="text-xs text-white/60">{item.wear}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">
                    Objem 7d: {formatNumber(item.volume7d)}
                  </span>
                  <span className="font-semibold">
                    {item.price ? currency.format(item.price) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-sky-300 pt-1">
                  <Link href={getSkinDetailPath(item.name)} className="hover:underline">
                    Detail skinu
                  </Link>
                  <a
                    href={item.marketPage || item.itemPage}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-white/70"
                  >
                    Skinport
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
