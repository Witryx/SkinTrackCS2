type Skin = { id: string; name: string; weapon: string; rarity: "Common"|"Uncommon"|"Rare"|"Mythical"|"Legendary"; price: number };

const mockSkins: Skin[] = [
  { id: "1", name: "AK-47 | Redline", weapon: "AK-47", rarity: "Mythical", price: 19.9 },
  { id: "2", name: "AWP | Asiimov", weapon: "AWP", rarity: "Legendary", price: 149.0 },
  { id: "3", name: "Glock-18 | Water Elemental", weapon: "Glock-18", rarity: "Rare", price: 5.1 },
];

export default function ExplorerPage() {
  return (
    <section className="grid gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skin Explorer (demo)</h1>
          <p className="text-[color:var(--muted)]">Testovací seznam – později půjde z DB přes Prisma.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="[&>th]:text-left [&>th]:px-4 [&>th]:py-3">
              <th>Název</th>
              <th>Zbraň</th>
              <th>Rarita</th>
              <th className="text-right pr-6">Cena (EUR)</th>
            </tr>
          </thead>
          <tbody>
            {mockSkins.map((s) => (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.weapon}</td>
                <td className="px-4 py-3">{s.rarity}</td>
                <td className="px-4 py-3 text-right pr-6">{s.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
