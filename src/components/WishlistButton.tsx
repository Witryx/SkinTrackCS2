"use client";

import { useEffect, useState } from "react";

type WishlistButtonProps = {
  marketHashName: string;
  compact?: boolean;
  className?: string;
};

const join = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function WishlistButton({
  marketHashName,
  compact = false,
  className,
}: WishlistButtonProps) {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [wished, setWished] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedSteamId = window.localStorage.getItem("steamId");
    setSteamId(savedSteamId);

    const handleWishlistChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        marketHashName?: string;
        wished?: boolean;
      }>).detail;
      if (detail?.marketHashName === marketHashName) {
        setWished(Boolean(detail.wished));
      }
    };

    window.addEventListener("skintrack:wishlist-changed", handleWishlistChanged);
    return () =>
      window.removeEventListener(
        "skintrack:wishlist-changed",
        handleWishlistChanged
      );
  }, [marketHashName]);

  useEffect(() => {
    if (!steamId) {
      setWished(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      steamId,
      marketHashName,
    });

    fetch(`/api/wishlist/status?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json();
        setWished(Boolean(body.wished));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Wishlist status failed", error);
        }
      });

    return () => controller.abort();
  }, [marketHashName, steamId]);

  const dispatchChange = (nextWished: boolean) => {
    window.dispatchEvent(
      new CustomEvent("skintrack:wishlist-changed", {
        detail: { marketHashName, wished: nextWished },
      })
    );
  };

  const toggleWishlist = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!steamId) {
      window.location.href = "/api/steam/login";
      return;
    }

    setLoading(true);
    try {
      const response = wished
        ? await fetch(
            `/api/wishlist?${new URLSearchParams({
              steamId,
              marketHashName,
            }).toString()}`,
            { method: "DELETE" }
          )
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ steamId, marketHashName }),
          });

      if (!response.ok) {
        throw new Error("Wishlist request failed");
      }

      const nextWished = !wished;
      setWished(nextWished);
      dispatchChange(nextWished);
    } catch (error) {
      console.error("Wishlist update failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      aria-pressed={wished}
      disabled={loading}
      onClick={toggleWishlist}
      className={join(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border font-semibold transition disabled:cursor-wait disabled:opacity-60",
        compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs",
        wished
          ? "border-emerald-300/55 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/25"
          : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]",
        className
      )}
      title={wished ? "Odebrat z wishlistu" : "Pridat do wishlistu"}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7-4.35-9.33-8.25C.92 9.82 2.45 6 5.86 6A5.02 5.02 0 0 1 12 8.2 5.02 5.02 0 0 1 18.14 6c3.41 0 4.94 3.82 3.19 6.75C19 16.65 12 21 12 21Z" />
      </svg>
      <span>{compact ? "Wishlist" : wished ? "Ve wishlistu" : "Wishlist"}</span>
    </button>
  );
}
