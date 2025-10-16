import Link from "next/link";
import { notFound } from "next/navigation";
import { mockSkins, rarityColors } from "../../lib/mock/skins";

export default function SkinDetail({ params }: { params: { id: string } }) {
  const skin = mockSkins.find((x) => x.id === params.id);
  if (!skin) return notFound();

  const color = rarityColors[skin.rarity];

  return (
    <section className="p-6 space-y-6">
      <Link href="/explorer" className="text-white/70 hover:underline">
        ← Zpět na Explorer
      </Link>

      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        <div className="relative aspect-video bg-black/30 flex items-center justify-center">
          {skin.image ? (
            <img
              src={skin.image}
              alt={skin.name}
              className="max-h-[220px] object-contain drop-shadow-2xl"
            />
          ) : (
            <div className="text-white/50 text-sm">no image</div>
          )}
          <div
            className={`absolute top-0 left-0 w-full h-1.5 bg-${color}-500`}
          />
        </div>

        <div className="p-6 grid gap-2">
          <h1 className="text-2xl font-bold">{skin.name}</h1>
          <div className="text-white/70">{skin.weapon}</div>
          <div className={`font-medium text-${color}-400`}>{skin.rarity}</div>
          <div className="text-xl font-semibold mt-2">€{skin.price.toFixed(2)}</div>
          <p className="text-white/60 mt-2">
            Toto je testovací detail. Později sem napojíme reálné ceny, floaty,
            trhy, galerii a další informace.
          </p>
        </div>
      </div>
    </section>
  );
}
