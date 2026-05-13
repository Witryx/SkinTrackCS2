"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSkinDetailPath } from "@/app/lib/skin-images";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  previousPrice: number | null;
  currentPrice: number | null;
  changePercent: number | null;
  direction: "UP" | "DOWN" | null;
  currency: string;
  readAt: string | null;
  createdAt: string;
  skin: {
    name: string;
    weapon: string;
    skin: string;
  };
};

type NotificationBellProps = {
  steamId: string | null;
};

const formatMoney = (value: number | null, currency: string) =>
  typeof value === "number"
    ? new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value)
    : "-";

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function NotificationBell({ steamId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!steamId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ steamId, limit: "12" });
      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) throw new Error("Notifications fetch failed");
      const body = await response.json();
      setItems(Array.isArray(body.notifications) ? body.notifications : []);
      setUnreadCount(Number(body.unreadCount) || 0);
    } catch (error) {
      console.error("Notifications fetch failed", error);
    } finally {
      setLoading(false);
    }
  }, [steamId]);

  useEffect(() => {
    if (!steamId) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, steamId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    if (!steamId || unreadCount === 0) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId }),
      });
      if (!response.ok) throw new Error("Notifications update failed");
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? now }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Notifications update failed", error);
    }
  };

  if (!steamId) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) refresh();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-semibold transition hover:border-[color:var(--accent-2)]"
        title="Oznameni"
      >
        <span aria-hidden="true">!</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-solid)] shadow-2xl animate-fade-slide">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Oznameni</div>
              <div className="text-xs text-[color:var(--muted)]">
                {unreadCount > 0 ? `${unreadCount} neprectenych` : "Vse precteno"}
              </div>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--card)] disabled:opacity-45"
            >
              Precist
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && !items.length && (
              <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
                Nacitam oznameni...
              </div>
            )}

            {!loading && !items.length && (
              <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
                Zatim tu nejsou zadna oznameni.
              </div>
            )}

            {items.map((item) => (
              <Link
                key={item.id}
                href={getSkinDetailPath(item.skin.name)}
                onClick={() => setOpen(false)}
                className="block border-b border-[color:var(--border)] px-4 py-3 transition last:border-b-0 hover:bg-[color:var(--card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!item.readAt && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent-2)]" />
                      )}
                      <div className="truncate text-sm font-semibold">
                        {item.skin.weapon} | {item.skin.skin}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      {item.message}
                    </div>
                    <div className="mt-2 text-xs text-[color:var(--muted)]">
                      {formatMoney(item.previousPrice, item.currency)}
                      {" -> "}
                      {formatMoney(item.currentPrice, item.currency)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-[color:var(--muted)]">
                    {formatTime(item.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
