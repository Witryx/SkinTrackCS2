import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkinImageUrl } from "@/app/lib/skin-images";
import { rarityBgClass } from "@/app/lib/rarity";
import { getSkinByName } from "@/app/lib/skinport";

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

export async function generateMetadata({ params }: PageProps) {
  const decodedName = decodeURIComponent(params.name);
  return {
    title: `${decodedName} | SkinTrack CS2`,
  };
}

export default async function SkinDetailPage({ params }: PageProps) {
  const decodedName = decodeURIComponent(params.name);
  const data = await getSkinByName(decodedName);

  if (!data) {
    notFound();
  }

  const imageUrl = getSkinImageUrl(data.name);

  return (
    <section className="container-max py-6 space-y-6">
      <Link href="/explorer" className="text-sm text-sky-300 hover:underline">
        ← Zpět do Exploreru
      </Link>

      <div className="card p-6 grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-sky-900/40 flex items-center justify-center p-6">
          <img
            src={imageUrl}
            alt={data.name}
            className="max-h-80 w-full object-contain drop-shadow-2xl"
            loading="lazy"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-sm text-white/60">{data.weapon}</div>
            <h1 className="text-2xl font-bold leading-tight">{data.skin}</h1>
            {data.wear && <div className="text-sm text-white/60 mt-1">{data.wear}</div>}
            {data.rarity && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 bg-white/5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    rarityBgClass[data.rarity as keyof typeof rarityBgClass] ?? "bg-white/60"
                  }`}
                />
                {data.rarity}
              </div>
            )}
            <div className="text-xs text-white/50 mt-1">{data.name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-white/60">Aktuální cena</div>
              <div className="text-2xl font-bold">
                {data.price ? currency.format(data.price) : "-"}
              </div>
              <div className="text-xs text-white/60">
                Rozpětí:{" "}
                {data.minPrice ? currency.format(data.minPrice) : "-"} –{" "}
                {data.maxPrice ? currency.format(data.maxPrice) : "-"}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-white/60">Median 7d</div>
              <div className="text-xl font-semibold">
                {data.median7d ? currency.format(data.median7d) : "-"}
              </div>
              <div className="text-xs text-white/60">
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
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition"
              >
                Otevřít Skinport market
              </a>
            )}
            {data.itemPage && (
              <a
                href={data.itemPage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:border-sky-400/60 transition"
              >
                Detail na Skinportu
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="card p-4 grid sm:grid-cols-3 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-white/60">Objem 7d</div>
          <div className="text-lg font-semibold">{formatNumber(data.volume7d)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-white/60">Skladem</div>
          <div className="text-lg font-semibold">{formatNumber(data.quantity)}</div>
          <div className="text-xs text-white/60">
            Mean cena: {data.meanPrice ? currency.format(data.meanPrice) : "-"}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-white/60">Median Skinport</div>
          <div className="text-lg font-semibold">
            {data.medianPrice ? currency.format(data.medianPrice) : "-"}
          </div>
        </div>
      </div>
    </section>
  );
}
