"use client";

import type { FormEvent } from "react";
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
  alertsEnabled: boolean;
  emailAlertsEnabled: boolean;
  skin: WishlistSkin;
};

type AlertSetting = "alertsEnabled" | "emailAlertsEnabled";

export default function WishlistPage() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [email, setEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingAlertKey, setUpdatingAlertKey] = useState<string | null>(null);
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
      const nextEmail = body.email ?? "";
      setItems(nextItems);
      setEmail(nextEmail);
      setEmailDraft(nextEmail);
    } catch (error) {
      console.error("Wishlist fetch failed", error);
      setStatus("Wishlist se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!steamId) return;

    const nextEmail = emailDraft.trim();
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setStatus("Zadej platný e-mail.");
      return;
    }

    setSavingEmail(true);
    setStatus(null);

    try {
      const response = await fetch("/api/wishlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId,
          email: nextEmail,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "E-mail update failed");
      }

      const savedEmail = body?.email ?? "";
      setEmail(savedEmail);
      setEmailDraft(savedEmail);
      setStatus(
        savedEmail
          ? "E-mail pro alerty byl uložen šifrovaně."
          : "E-mail pro alerty byl odebrán."
      );
    } catch (error) {
      console.error("Wishlist e-mail update failed", error);
      setStatus(
        error instanceof Error ? error.message : "E-mail se nepodařilo uložit."
      );
    } finally {
      setSavingEmail(false);
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
      setStatus("Skin se nepodařilo odebrat.");
    }
  };

  const toggleAlertSetting = async (
    skinId: number,
    setting: AlertSetting,
    enabled: boolean
  ) => {
    if (!steamId) return;
    if (setting === "emailAlertsEnabled" && enabled && !email) {
      setStatus("Nejdřív ulož e-mail pro alerty.");
      return;
    }

    const previousItems = items;
    const updateKey = `${skinId}:${setting}`;
    setUpdatingAlertKey(updateKey);
    setStatus(null);
    setItems((current) =>
      current.map((item) =>
        item.skin.id === skinId
          ? { ...item, [setting]: enabled }
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
          [setting]: enabled,
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
              ? {
                  ...item,
                  alertsEnabled: body.item.alertsEnabled,
                  emailAlertsEnabled: body.item.emailAlertsEnabled,
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error("Wishlist alert update failed", error);
      setItems(previousItems);
      setStatus("Alert se nepodařilo uložit.");
    } finally {
      setUpdatingAlertKey(null);
    }
  };

  const renderAlertToggle = (
    item: WishlistItem,
    setting: AlertSetting,
    label: string
  ) => {
    const enabled = item[setting];
    const updateKey = `${item.skin.id}:${setting}`;
    const disabled = updatingAlertKey === updateKey;

    return (
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => toggleAlertSetting(item.skin.id, setting, !enabled)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-2.5 py-1 transition hover:border-[color:var(--accent-2)] disabled:cursor-wait disabled:opacity-60"
      >
        <span
          className={
            enabled
              ? "relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500"
              : "relative inline-flex h-5 w-9 items-center rounded-full bg-slate-600"
          }
        >
          <span
            className={
              enabled
                ? "ml-4 h-4 w-4 rounded-full bg-white transition"
                : "ml-0.5 h-4 w-4 rounded-full bg-white transition"
            }
          />
        </span>
        <span>{label}</span>
      </button>
    );
  };

  if (!steamId) {
    return (
      <section className="container-max py-10">
        <div className="card p-8">
          <div className="kicker">Wishlist</div>
          <h1 className="display mt-2 text-3xl">Přihlášení přes Steam</h1>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Wishlist je vázaný na Steam účet.
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/api/steam/login")}
            className="btn-primary mt-5"
          >
            Přihlásit přes Steam
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
          <h1 className="display text-4xl">Sledované skiny</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            U každého skinu můžeš zvlášť zapnout oznámení do zvonečku a e-mail.
          </p>
        </div>
        <div className="stat-tile min-w-32 text-center text-sm text-[color:var(--muted)]">
          <div className="text-3xl font-black text-[color:var(--fg)]">{items.length}</div>
          {items.length} skinů
        </div>
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-[color:var(--muted)]">
              E-mail pro alerty
            </div>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Kontakt se ukládá šifrovaně a používá se jen pro cenové alerty.
            </p>
          </div>
          <form
            onSubmit={saveNotificationEmail}
            className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl"
          >
            <input
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              placeholder="email@example.com"
              aria-label="E-mail pro alerty"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] px-3 text-sm font-semibold outline-none transition focus:border-[color:var(--accent)]"
            />
            <button
              type="submit"
              disabled={savingEmail || emailDraft.trim() === email}
              className="btn-primary min-w-28 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEmail ? "Ukládám..." : "Uložit"}
            </button>
          </form>
        </div>
      </div>

      {status && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--muted)]">
          {status}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          Načítám wishlist...
        </div>
      )}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          Zatím nemáš ve wishlistu žádný skin.
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
              <div className="text-xs text-[color:var(--muted)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex shrink-0 items-center gap-2">
                    {renderAlertToggle(item, "alertsEnabled", "Alerty")}
                    {renderAlertToggle(item, "emailAlertsEnabled", "E-mail")}
                  </div>
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
