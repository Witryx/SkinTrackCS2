export default function HomePage() {
  return (
    <section className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Vítej ve SkinTrack CS2 👋</h1>
        <p className="mt-2 text-[color:var(--muted)]">
          Projekt pro sledování skinů, cen a porovnávání marketplace. Pokračuj do{" "}
          <a href="/explorer" className="link">Exploreru</a>.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5"><h3 className="font-semibold">⚙️ Základ</h3><p className="text-sm mt-1 text-[color:var(--muted)]">Next.js + Tailwind + TS + Dark mode</p></div>
        <div className="card p-5"><h3 className="font-semibold">🗄️ DB</h3><p className="text-sm mt-1 text-[color:var(--muted)]">MariaDB + Prisma (další krok)</p></div>
        <div className="card p-5"><h3 className="font-semibold">🧪 Explorer</h3><p className="text-sm mt-1 text-[color:var(--muted)]">Testovací seznam skinů</p></div>
      </div>
    </section>
  );
}
