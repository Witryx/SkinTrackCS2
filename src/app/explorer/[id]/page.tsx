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

  // OBCHODY
  const shops = [
    { id: "steam", name: "Steam Market", price: skin.price * 1.12, url: "#", note: "avg" },
    { id: "skinport", name: "SkinPort", price: skin.price * 0.95, url: "#", note: "low" },
    { id: "buff", name: "Buff.163", price: skin.price * 0.90, url: "#", note: "nejnižší" },
    { id: "csfloat", name: "CSFloat", price: skin.price * 1.0, url: "#", note: "list" },
  ];

  return (
    <section className="min-h-screen w-full pb-16 overflow-x-hidden">
      {/* Zpět */}
      <div className="px-6 pt-6">
        <Link
          href="/explorer"
          className="text-neutral-600 hover:underline dark:text-white/70"
        >
          ← Zpět na Explorer
        </Link>
      </div>

      {/* Rarity bar */}
      <div className={`mt-4 h-1.5 w-full ${rarityBgClass[skin.rarity]}`} />

      {/* Hlavní rozložení */}
      <div className="mt-6 grid grid-cols-1 gap-8 px-6 md:grid-cols-5">
        {/* LEVÁ STRANA (shops)*/}
        <div className="md:col-span-3">
          <h2 className="text-xl font-semibold mb-4 text-neutral-900 dark:text-white">
            Dostupné nabídky
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shops.map((sh) => (
              <div
                key={sh.id}
                className="
                  rounded-2xl p-4 transition
                  border bg-white hover:bg-neutral-50 border-neutral-200
                  dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10
                "
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-neutral-600 dark:text-white/70">
                      {sh.name}
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      €{sh.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-white/50 mt-1">
                      {sh.note}
                    </div>
                  </div>

                  <a
                    href={sh.url}
                    className="
                      rounded-xl px-3 py-2 text-sm transition
                      border bg-white hover:bg-neutral-50 border-neutral-200
                      dark:bg-white/5 dark:hover:bg-white/15 dark:border-white/10
                    "
                  >
                    Otevřít
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRAVÁ STRANA */}
        <aside className="md:col-span-2 md:sticky md:top-6 self-start">
          <div className="flex items-center justify-center py-10">
            <img
              src={skin.image}
              alt={skin.name}
              className="
                max-h-[48vh] w-auto object-contain
                drop-shadow-[0_0_30px_rgba(0,0,0,0.10)]
                dark:drop-shadow-[0_0_40px_rgba(255,255,255,0.15)]
              "
            />
          </div>

          {/* Text info*/}
          <div className="p-0 md:p-0">
            <h1 className="text-3xl font-bold">{skin.name}</h1>
            <div className="text-neutral-700 dark:text-white/70 mt-1">
              {skin.weapon}
            </div>

            <div
              className={`inline-block mt-3 rounded-full px-3 py-1 text-sm font-medium border
                          border-neutral-200 bg-neutral-50
                          dark:bg-white/5 dark:border-white/10
                          ${rarityTextClass[skin.rarity]}`}
            >
              {skin.rarity}
            </div>

            <div className="mt-5 text-sm text-neutral-700 dark:text-white/70 leading-relaxed">
              Testovací detail. Později reálné ceny, floaty, trhy, nálepky,
              historii a další informace.
            </div>

            {/* Mini-card s cenou*/}
            <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:bg-white/5 dark:border-white/10">
              <div className="text-sm text-neutral-600 dark:text-white/60">
                Nejnižší cena
              </div>
              <div className="text-2xl font-semibold mt-1">
                €{skin.price.toFixed(2)}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
