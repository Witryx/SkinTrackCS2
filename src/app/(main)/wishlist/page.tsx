"use client";

import { useEffect, useState } from "react";
import SkinMarketCard from "@/components/SkinMarketCard";

type WishlistSkin = {
  id: number;
  name: string;
  weapon: string;
  skin: string;
  wear: string | null;
  rarity: string;
  minFloat: number | null;
  maxFloat: number | null;
  price: number | null;
  medianPrice: number | null;
  suggestedPrice: number | null;
  volume7d: number | null;
  median7d: number | null;
  quantity: number | null;
  itemPage: string | null;
  marketPage: string | null;
  updatedAt: string;
};

type WishlistItem = {
  addedAt: string;
  emailAlertsEnabled: boolean;
  skin: WishlistSkin;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function WishlistPage() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [email, setEmail] = useState("");
  const [thresholdPercent, setThresholdPercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [updatingAlertSkinId, setUpdatingAlertSkinId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const savedSteamId = window.localStorage.getItem("steamId");
    setSteamId(savedSteamId);
    if (!savedSteamId) {
      setLoading(false);
      return;
    }

    fetchWishlist(savedSteamId);

    const handleWishlistChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        marketHashName?: string;
        wished?: boolean;
      }>).detail;

      if (!detail?.marketHashName) return;

      if (detail.wished === false) {
        setItems((current) =>
          current.filter((item) => item.skin.name !== detail.marketHashName)
        );
        return;
      }

      fetchWishlist(savedSteamId);
    };

    window.addEventListener("skintrack:wishlist-changed", handleWishlistChanged);
    return () =>
      window.removeEventListener(
        "skintrack:wishlist-changed",
        handleWishlistChanged
      );
  }, []);

  const fetchWishlist = async (id: string) => {
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({ steamId: id });
      const response = await fetch(`/api/wishlist?${params.toString()}`);
      if (!response.ok) throw new Error("Wishlist fetch failed");
      const body = await response.json();
      const nextItems = Array.isArray(body.items) ? body.items : [];
      setItems(nextItems);
      setEmail(body.email ?? "");
      setThresholdPercent(Number(body.sharpThresholdPercent) || 10);
    } catch (error) {
      console.error("Wishlist fetch failed", error);
      setStatus("Wishlist se nepodarilo nacist.");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (marketHashName: string) => {
    if (!steamId) return;

    setStatus(null);
    try {
      const params = new URLSearchParams({ steamId, marketHashName });
      const response = await fetch(`/api/wishlist?${params.toString()}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Wishlist remove failed");
      setItems((current) =>
        current.filter((item) => item.skin.name !== marketHashName)
      );
      window.dispatchEvent(
        new CustomEvent("skintrack:wishlist-changed", {
          detail: { marketHashName, wished: false },
        })
      );
    } catch (error) {
      console.error("Wishlist remove failed", error);
      setStatus("Skin se nepodarilo odebrat.");
    }
  };

  const toggleEmailAlerts = async (
    skinId: number,
    enabled: boolean
  ) => {
    if (!steamId) return;

    const previousItems = items;
    setUpdatingAlertSkinId(skinId);
    setStatus(null);
    setItems((current) =>
      current.map((item) =>
        item.skin.id === skinId
          ? { ...item, emailAlertsEnabled: enabled }
          : item
      )
    );

    try {
      const response = await fetch("/api/wishlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId,
          skinId,
          emailAlertsEnabled: enabled,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Alert update failed");
      }

      if (body?.item) {
        setItems((current) =>
          current.map((item) =>
            item.skin.id === skinId
              ? { ...item, emailAlertsEnabled: body.item.emailAlertsEnabled }
              : item
          )
        );
      }
    } catch (error) {
      console.error("Wishlist alert update failed", error);
      setItems(previousItems);
      setStatus("Alert se nepodarilo ulozit.");
    } finally {
      setUpdatingAlertSkinId(null);
    }
  };

  if (!steamId) {
    return (
      <section className="container-max py-10">
        <div className="card p-8">
          <div className="kicker">Wishlist</div>
          <h1 className="display mt-2 text-3xl">Prihlaseni pres Steam</h1>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Wishlist je vazany na Steam ucet.
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/api/steam/login")}
            className="btn-primary mt-5"
          >
            Prihlasit pres Steam
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="container-max space-y-7 py-8">
      <div className="market-stage p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="kicker">Wishlist</div>
          <h1 className="display text-4xl">Sledovane skiny</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Cenove alerty muzes zapnout nebo vypnout u kazdeho skinu. E-mail odchazi pri prudke zmene od {thresholdPercent} %.
          </p>
        </div>
        <div className="stat-tile min-w-32 text-center text-sm text-[color:var(--muted)]">
          <div className="text-3xl font-black text-[color:var(--fg)]">{items.length}</div>
          {items.length} skinu
        </div>
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-[color:var(--muted)]">
              E-mail ze Steam uctu
            </div>
            <div className="mt-2 text-sm font-semibold text-[color:var(--fg)]">
              {email || "U Steam uctu neni v DB ulozeny e-mail."}
            </div>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Alerty se posilaji na e-mail ulozeny u prihlaseneho Steam uctu.
            </p>
          </div>
          <div
            className={
              email
                ? "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200"
                : "rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200"
            }
          >
            {email ? "E-mail pripraveny" : "E-mail chybi"}
          </div>
        </div>
      </div>

      {status && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--muted)]">
          {status}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          Nacitam wishlist...
        </div>
      )}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          Zatim nemas ve wishlistu zadny skin.
        </div>
      )}

      {!!items.length && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.skin.id} className="space-y-2">
              <SkinMarketCard
                name={item.skin.name}
                weapon={item.skin.weapon}
                skin={item.skin.skin}
                wear={item.skin.wear}
                rarity={item.skin.rarity}
                minFloat={item.skin.minFloat}
                maxFloat={item.skin.maxFloat}
                price={item.skin.price}
                volume7d={item.skin.volume7d}
                median7d={item.skin.median7d}
                quantity={item.skin.quantity}
                itemPage={item.skin.itemPage}
                marketPage={item.skin.marketPage}
                density="compact"
              />
              <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--muted)]">
                <span>Pridano {formatDate(item.addedAt)}</span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.emailAlertsEnabled}
                    disabled={updatingAlertSkinId === item.skin.id}
                    onClick={() =>
                      toggleEmailAlerts(item.skin.id, !item.emailAlertsEnabled)
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-2.5 py-1 transition hover:border-[color:var(--accent-2)] disabled:cursor-wait disabled:opacity-60"
                  >
                    <span
                      className={
                        item.emailAlertsEnabled
                          ? "relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500"
                          : "relative inline-flex h-5 w-9 items-center rounded-full bg-slate-600"
                      }
                    >
                      <span
                        className={
                          item.emailAlertsEnabled
                            ? "ml-4 h-4 w-4 rounded-full bg-white transition"
                            : "ml-0.5 h-4 w-4 rounded-full bg-white transition"
                        }
                      />
                    </span>
                    <span>{item.emailAlertsEnabled ? "Alerty" : "Bez alertu"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.skin.name)}
                    className="rounded-full border border-[color:var(--border)] px-3 py-1 transition hover:border-rose-400/60 hover:text-rose-400"
                  >
                    Odebrat
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
