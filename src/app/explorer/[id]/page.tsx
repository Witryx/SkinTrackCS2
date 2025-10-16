import Link from "next/link";
import { notFound } from "next/navigation";
import {
  mockSkins,
  rarityBgClass,
  rarityTextClass,
} from "../../lib/mock/skins";

export default function SkinDetail({ params }: { params: { id: string } }) {
  const skin = mockSkins.find((x) => x.id === params.id);
  if (!skin) return notFound();

  // dočasné mocky 4 obchodů – později napojíme na API
  const shops = [
    { id: "steam",    name: "Steam Market",   price: skin.price * 1.12, url: "#", note: "avg" },
    { id: "skinport", name: "SkinPort",       price: skin.price * 0.95, url: "#", note: "low" },
    { id: "buff",     name: "Buff.163",       price: skin.price * 0.90, url: "#", note: "lowest" },
    { id: "csfloat",  name: "CSFloat",        price: skin.price * 1.00, url: "#", note: "list" },
  ];

  return (
    <section className="min-h-screen w-full bg-[#0b0f17] pb-16">
      {/* Zpět */}
      <div className="px-6 pt-6">
        <Link href="/explorer" className="text-white/70 hover:underline">
          ← Zpět na Explorer
        </Link>
      </div>

      {/* Rarity bar přes celou šířku */}
      <div className={`mt-4 h-1.5 w-full ${rarityBgClass[skin.rarity]}`} />

      {/* Hlavní rozložení: vlevo obchody, vpravo hero + popis */}
      <div className="mt-6 grid grid-cols-1 gap-8 px-6 md:grid-cols-5">
        {/* LEVÁ STRANA – 4 obchody */}
        <div className="md:col-span-3">
          <h2 className="text-xl font-semibold mb-4">Dostupné nabídky</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shops.map((sh) => (
              <div
                key={sh.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/70">{sh.name}</div>
                    <div className="mt-1 text-2xl font-bold">
                      €{sh.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      {sh.note === "lowest" ? "nejnižší" : sh.note}
                    </div>
                  </div>

                  <a
                    href={sh.url}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/15"
                  >
                    Otevřít
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRAVÁ STRANA – obrázek + info (sticky box) */}
        <aside className="md:col-span-2 md:sticky md:top-6 self-start">
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* HERO obrázek */}
            <div className="bg-black/30 flex items-center justify-center py-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={skin.image}
                alt={skin.name}
                className="max-h-[48vh] w-auto object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.15)]"
              />
            </div>

            {/* Info blok */}
            <div className="p-6">
              <h1 className="text-3xl font-bold">{skin.name}</h1>
              <div className="text-white/70 mt-1">{skin.weapon}</div>
              <div
                className={`inline-block mt-3 rounded-full px-3 py-1 text-sm font-medium border border-white/10 bg-white/5 ${rarityTextClass[skin.rarity]}`}
              >
                {skin.rarity}
              </div>

              <div className="mt-5 text-sm text-white/70 leading-relaxed">
                Toto je testovací detail. Později sem napojíme reálné ceny,
                floaty, trhy, nálepky, historii a další informace.
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/60">Nejnižší cena</div>
                <div className="text-2xl font-semibold mt-1">
                  €{skin.price.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
