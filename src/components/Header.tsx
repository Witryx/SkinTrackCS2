"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { useEffect, useRef, useState } from "react";
import NotificationBell from "./NotificationBell";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Domů" },
  { href: "/explorer", label: "Explorer" },
  { href: "/tradeup", label: "Trade-up sim" },
] as const;

export default function Header() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [steamName, setSteamName] = useState<string | null>(null);
  const [steamAvatar, setSteamAvatar] = useState<string | null>(null);
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("steamId");

    if (id) {
      localStorage.setItem("steamId", id);
      url.searchParams.delete("steamId");
      window.history.replaceState({}, "", url.toString());
      loadSteamProfile(id);
    } else {
      const savedId = localStorage.getItem("steamId");
      if (savedId) loadSteamProfile(savedId);
    }
  }, []);

  async function loadSteamProfile(id: string) {
    try {
      const res = await fetch(`/api/steam/profile/${id}`);
      if (!res.ok) throw new Error("Profile fetch failed");
      const data = await res.json();
      const p = data.player;

      setSteamId(id);
      setSteamName(p.personaname);
      setSteamAvatar(p.avatarfull);
    } catch (e) {
      console.error("Steam profile failed:", e);
    }
  }

  function logout() {
    localStorage.removeItem("steamId");
    setSteamId(null);
    setSteamAvatar(null);
    setSteamName(null);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--bg)] shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
      <div className="container-max flex min-h-[4.5rem] items-center justify-between gap-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--card-solid)] shadow-sm">
            <Image
              src="/logo.png"
              alt="SkinTrack CS2"
              width={32}
              height={32}
              className="rounded-xl"
            />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">
              SkinTrack
            </div>
            <div className="truncate text-lg font-black">CS2 Market</div>
          </div>
        </Link>

        <nav className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1 sm:flex">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[color:var(--card-solid)] text-[color:var(--fg)] shadow-sm"
                      : "text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {steamId && (
            <Link
              href="/wishlist"
              className={`hidden rounded-xl border px-3 py-2 text-sm font-semibold transition md:inline-flex ${
                pathname?.startsWith("/wishlist")
                  ? "border-[color:var(--accent)] bg-[color:var(--card-solid)] text-[color:var(--fg)]"
                  : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
              }`}
            >
              Wishlist
            </Link>
          )}

          <ThemeToggle />
          <NotificationBell steamId={steamId} />

          {!steamId && (
            <button
              onClick={() => (window.location.href = "/api/steam/login")}
              className="btn-primary hidden text-sm md:inline-flex"
            >
              Přihlásit přes Steam
            </button>
          )}

          {steamId && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpen(!open)}
                className="flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-sm font-semibold transition hover:border-[color:var(--accent)]"
              >
                {steamAvatar ? (
                  <img
                    src={steamAvatar}
                    alt="Avatar"
                    className="h-8 w-8 rounded-xl"
                  />
                ) : (
                  <span className="h-8 w-8 rounded-xl bg-[color:var(--surface-strong)]" />
                )}
                <span className="hidden max-w-32 truncate sm:inline">{steamName}</span>
              </button>

              {open && (
                <div className="card absolute right-0 mt-2 w-60 p-2 shadow-lg animate-fade-slide">
                  <Link
                    href="/inventory"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--muted)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--fg)]"
                  >
                    Inventář
                  </Link>

                  <button
                    onClick={logout}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-500 hover:bg-rose-500/10"
                  >
                    Odhlásit se
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

