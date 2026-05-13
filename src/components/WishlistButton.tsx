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
          : "border-slate-500/50 bg-slate-950/55 text-slate-200 hover:border-cyan-300/55 hover:bg-cyan-500/15",
        className
      )}
      title={wished ? "Odebrat z wishlistu" : "Pridat do wishlistu"}
    >
      <span aria-hidden="true">{wished ? "-" : "+"}</span>
      <span>{compact ? "Wishlist" : wished ? "Ve wishlistu" : "Wishlist"}</span>
    </button>
  );
}
