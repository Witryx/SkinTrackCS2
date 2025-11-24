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

  // ✔ zavírání menu kliknutím mimo
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // načítání profilu
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--bg)]/80 backdrop-blur">
      <div className="container-max h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/logo.png" alt="SkinTrack CS2 Logo" width={32} height={32} className="rounded-md" />
          <span>SkinTrack CS2</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm hover:bg-white/5 transition">
            Domů
          </Link>

          <Link href="/explorer" className="rounded-lg px-3 py-2 text-sm hover:bg-white/5 transition">
            Explorer
          </Link>

          <ThemeToggle />

          {/* 🔥 NEPŘIHLÁŠENÝ */}
          {!steamId && (
            <button
              onClick={() => (window.location.href = "/api/steam/login")}
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded transition"
            >
              Přihlásit přes Steam
            </button>
          )}

          {/* 🔥 PŘIHLÁŠENÝ */}
          {steamId && (
            <div className="relative" ref={menuRef}>
              {/* Avatar + jméno */}
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition"
              >
                <img src={steamAvatar || ""} alt="Avatar" className="w-8 h-8 rounded-full" />
                <span className="text-sm">{steamName}</span>
              </button>

              {/* 🔻 DROPDOWN MENU */}
              {open && (
                <div className="absolute left-0 mt-2 w-56 bg-[#0d1117] border border-white/10 rounded-lg shadow-xl 
                  animate-[fadeIn_0.15s_ease-out,slideDown_0.15s_ease-out] overflow-hidden z-50">

                  <Link
                    href={`/profile/${steamId}`}
                    className="block px-4 py-2 text-sm hover:bg-white/5 transition"
                  >
                    👤 Můj profil
                  </Link>

                  <Link
                    href="/favorites"
                    className="block px-4 py-2 text-sm hover:bg-white/5 transition"
                  >
                    ⭐ Oblíbené skiny
                  </Link>

                  <Link
                    href="/inventory"
                    className="block px-4 py-2 text-sm hover:bg-white/5 transition opacity-50 cursor-not-allowed"
                  >
                    🎒 Inventář (brzy)
                  </Link>

                  <Link
                    href="/tradeup"
                    className="block px-4 py-2 text-sm hover:bg-white/5 transition"
                  >
                    🔧 Trade-up sim
                  </Link>

                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    🚪 Odhlásit
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Animace */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-4px); }
          to { transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
