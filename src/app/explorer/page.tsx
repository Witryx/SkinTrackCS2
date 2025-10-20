"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  mockSkins,
  rarityBgClass,
  rarityTextClass,
  type Skin,
} from "../lib/mock/skins";

export default function ExplorerPage() {
  const [q, setQ] = useState("");

  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return mockSkins;
    return mockSkins.filter(
      (x) =>
        x.name.toLowerCase().includes(s) ||
        x.weapon.toLowerCase().includes(s) ||
        x.rarity.toLowerCase().includes(s)
    );
  }, [q]);

  return (
    <section className="p-6 space-y-6">
      {/* Nadpis + vyhledávání */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skin Explorer (demo)</h1>
          <p className="text-white/60">Testovací seznam</p>
        </div>

        <div className="w-full sm:w-80">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat název / zbraň / raritu…"
            className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 outline-none"
          />
        </div>
      </header>

      {/* Seznam karet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {data.map((s) => (
          <Link
            key={s.id}
            href={`/explorer/${s.id}`}
            className="bg-white/5 rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform border border-white/10 flex flex-col"
          >
            {/* Pic + rarity bar */}
            <div className="relative aspect-video bg-black/30 flex items-center justify-center">
              {s.image ? (
                <img
                  src={s.image}
                  alt={s.name}
                  className="max-h-[140px] object-contain drop-shadow-xl"
                />
              ) : (
                <div className="text-white/50 text-sm">no image</div>
              )}
              <div
                className={`absolute top-0 left-0 w-full h-1.5 ${rarityBgClass[s.rarity]}`}
              />
            </div>

            {/* Obsah */}
            <div className="p-4 flex flex-col gap-1">
              <div className="text-xs text-white/60">{s.weapon}</div>
              <div className="font-semibold text-lg">{s.name}</div>
              <div className={`text-sm font-medium ${rarityTextClass[s.rarity]}`}>
                {s.rarity}
              </div>
              <div className="mt-2 text-right text-[17px] font-semibold">
                €{s.price.toFixed(2)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
