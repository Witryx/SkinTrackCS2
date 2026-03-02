export default function Loading() {
  return (
    <section className="container-max py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 rounded bg-[color:var(--card)]" />
        <div className="h-6 w-24 rounded-full bg-[color:var(--card)]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="card h-80 animate-pulse bg-[color:var(--card)]" />
        <div className="card h-80 animate-pulse bg-[color:var(--card)]" />
      </div>

      <div className="card h-72 animate-pulse bg-[color:var(--card)]" />
      <div className="card h-64 animate-pulse bg-[color:var(--card)]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card h-24 animate-pulse bg-[color:var(--card)]" />
        <div className="card h-24 animate-pulse bg-[color:var(--card)]" />
        <div className="card h-24 animate-pulse bg-[color:var(--card)]" />
      </div>
    </section>
  );
}
