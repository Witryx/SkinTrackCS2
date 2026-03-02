"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { useEffect, useRef, useState } from "react";

export default function Header() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [steamName, setSteamName] = useState<string | null>(null);
  const [steamAvatar, setSteamAvatar] = useState<string | null>(null);

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
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--bg)] backdrop-blur">
      <div className="container-max h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] shadow-sm">
            <Image
              src="/logo.png"
              alt="SkinTrack CS2"
              width={28}
              height={28}
              className="rounded-lg"
            />
          </span>
          <div className="leading-tight">
            <div className="kicker">SkinTrack</div>
            <div className="text-lg font-semibold">CS2 Market</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="rounded-full px-3 py-2 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--card)] hover:text-[color:var(--fg)]"
          >
            Domu
          </Link>

          <Link
            href="/explorer"
            className="rounded-full px-3 py-2 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--card)] hover:text-[color:var(--fg)]"
          >
            Explorer
          </Link>

          <ThemeToggle />

          {!steamId && (
            <button
              onClick={() => (window.location.href = "/api/steam/login")}
              className="btn-primary text-sm"
            >
              Prihlasit pres Steam
            </button>
          )}

          {steamId && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm transition hover:border-[color:var(--accent)]"
              >
                <img
                  src={steamAvatar || ""}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full"
                />
                <span className="hidden sm:inline">{steamName}</span>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-56 card p-2 shadow-lg animate-fade-slide">
                  <Link
                    href="/favorites"
                    className="block rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--card-solid)]"
                  >
                    Oblibene skiny (brzy)
                  </Link>

                  <Link
                    href="/inventory"
                    className="block rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--card-solid)]"
                  >
                    Inventar
                  </Link>

                  <Link
                    href="/tradeup"
                    className="block rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--card-solid)]"
                  >
                    Trade-up simulator
                  </Link>

                  <button
                    onClick={logout}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-rose-500 hover:bg-rose-500/10"
                  >
                    Odhlasit
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

