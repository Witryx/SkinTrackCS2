export default function HomePage() {
  return (
    <section className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">SkinTrack CS2</h1>
        <p className="mt-2 text-[color:var(--muted)]">
          Projekt pro sledování skinů, cen a porovnávání marketplace. Pokračuj do{" "}
          <a href="/explorer" className="link">Exploreru</a>.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
      </div>
    </section>
  );
}
