"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSkinDetailPath, getSkinImageUrl } from "@/app/lib/skin-images";
import { Rarity, rarityTextClass } from "@/app/lib/rarity";
import WishlistButton from "./WishlistButton";

type CardDensity = "regular" | "compact";

export type SkinMarketCardProps = {
  name: string;
  weapon: string;
  skin: string;
  wear?: string | null;
  rarity?: string | null;
  minFloat?: number | null;
  maxFloat?: number | null;
  price?: number | null;
  volume7d?: number | null;
  median7d?: number | null;
  quantity?: number | null;
  itemPage?: string | null;
  marketPage?: string | null;
  density?: CardDensity;
  className?: string;
};

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currency.format(value) : "-";

const wearToShort: Record<string, string> = {
  "Factory New": "FN",
  "Minimal Wear": "MW",
  "Field-Tested": "FT",
  "Well-Worn": "WW",
  "Battle-Scarred": "BS",
};

const wearBadgeClassByName: Record<string, string> = {
  "Factory New": "bg-lime-500/20 text-lime-200 border border-lime-300/40",
  "Minimal Wear": "bg-emerald-500/20 text-emerald-200 border border-emerald-300/40",
  "Field-Tested": "bg-sky-500/20 text-sky-200 border border-sky-300/40",
  "Well-Worn": "bg-violet-500/20 text-violet-200 border border-violet-300/40",
  "Battle-Scarred": "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-300/40",
};

const isStatTrak = (name: string, weapon: string) =>
  `${name} ${weapon}`.toLowerCase().includes("stattrak");

const isSouvenir = (name: string, weapon: string) =>
  `${name} ${weapon}`.toLowerCase().includes("souvenir");

const normalizeWeapon = (weapon: string) =>
  weapon.replace(/^stattrak(?:\u2122)?\s*/i, "").trim();

const normalizeLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const resolveWearShort = (wear?: string | null) => {
  if (!wear) return "STD";
  const normalized = wear.trim();
  if (!normalized) return "STD";
  return wearToShort[normalized] ?? normalized.slice(0, 2).toUpperCase();
};

const resolveWearBadgeClass = (wear?: string | null) => {
  if (!wear) return "bg-slate-500/20 text-slate-200 border border-slate-300/30";
  return (
    wearBadgeClassByName[wear.trim()] ??
    "bg-slate-500/20 text-slate-200 border border-slate-300/30"
  );
};

const join = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function SkinMarketCard({
  name,
  weapon,
  skin,
  wear,
  rarity,
  price,
  density = "regular",
  className,
}: SkinMarketCardProps) {
  const router = useRouter();
  const detailPath = getSkinDetailPath(name);
  const imageUrl = getSkinImageUrl(name);
  const st = isStatTrak(name, weapon);
  const souvenir = isSouvenir(name, weapon);
  const weaponLabel = normalizeWeapon(weapon || "Skin");
  const skinLabel = (skin || "").trim();
  const wearShort = resolveWearShort(wear);
  const wearClass = resolveWearBadgeClass(wear);
  const compact = density === "compact";
  const showSkinSubtitle =
    !!skinLabel && normalizeLabel(weaponLabel) !== normalizeLabel(skinLabel);

  const rootCardClass = join(
    "group relative flex cursor-pointer flex-col overflow-hidden rounded-[0.95rem] border bg-[color:var(--card-solid)] transition",
    souvenir
      ? compact
        ? "border-amber-300/60 shadow-[var(--shadow-soft)] hover:border-amber-300/90"
        : "border-amber-300/60 shadow-[var(--shadow)] hover:-translate-y-1 hover:border-amber-300/90"
      : compact
        ? "border-[color:var(--border)] shadow-[var(--shadow-soft)] hover:border-[color:var(--accent)]"
        : "border-[color:var(--border)] shadow-[var(--shadow)] hover:-translate-y-1 hover:border-[color:var(--accent)]",
    className
  );

  const onCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    router.push(detailPath);
  };

  const onCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(detailPath);
    }
  };

  return (
    <article
      className={rootCardClass}
      role="link"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(34,211,238,0.1),transparent_45%),linear-gradient(315deg,rgba(245,158,11,0.08),transparent_45%)]" />
      <div className="relative z-10 flex h-full flex-col">
        <div className={join(compact ? "px-3.5 pt-3.5 pb-3.5" : "px-4 pt-4 pb-4")}>
          <div className="flex items-center justify-between gap-2">
            <WishlistButton marketHashName={name} compact={compact} />
            <div className="flex items-center justify-end gap-1.5">
              {st && (
                <span
                  className={join(
                    "rounded-lg border border-amber-300/45 bg-amber-500/20 px-2 text-[10px] font-semibold uppercase text-amber-100",
                    compact ? "py-0.5" : "py-1"
                  )}
                >
                  ST
                </span>
              )}
              <span
                className={join(
                  "rounded-lg px-2 text-[11px] font-semibold uppercase",
                  compact ? "py-0.5" : "py-1",
                  wearClass
                )}
              >
                {wearShort}
              </span>
            </div>
          </div>

          <div
            className={join(
              "market-stage mt-3 flex items-center justify-center overflow-hidden px-3",
              compact ? "h-40" : "h-48"
            )}
          >
            <img
              src={imageUrl}
              alt={name}
              loading="lazy"
              className={join(
                "w-full object-contain drop-shadow-[0_10px_22px_rgba(2,8,23,0.85)] transition duration-300 group-hover:scale-[1.025]",
                compact ? "max-h-36" : "max-h-44"
              )}
            />
          </div>

          <div className="mt-3 space-y-3">
            <div className="min-w-0 space-y-0.5">
              <div
                className={join(
                  "break-words font-black leading-none text-[color:var(--fg)]",
                  compact ? "text-[1.45rem]" : "text-[1.8rem]"
                )}
              >
                {weaponLabel}
              </div>
              {showSkinSubtitle && (
                <div
                  className={join(
                    "break-words font-semibold leading-tight text-[color:var(--muted-strong)]",
                    compact ? "text-base" : "text-lg"
                  )}
                >
                  {skinLabel}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-right">
              <div className="text-[11px] font-semibold text-[color:var(--muted)]">
                Aktuální cena
              </div>
              <div
                className={join(
                  "font-black leading-none text-[color:var(--fg)]",
                  compact ? "text-2xl" : "text-3xl"
                )}
              >
                {formatCurrency(price)}
              </div>
            </div>
          </div>

        </div>

        <div
          className={join(
            "mt-auto border-t border-[color:var(--border)] text-[color:var(--muted)]",
            compact ? "px-3.5 pb-3.5 pt-2.5 text-[11px]" : "px-4 pb-4 pt-3 text-xs"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={rarityTextClass[(rarity as Rarity) ?? "Mil-Spec"] ?? "text-[color:var(--muted)]"}>
              {rarity ?? "Unknown"}
            </span>
            <Link
              href={detailPath}
              prefetch={false}
              className={join(
                "inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] font-bold text-[color:var(--fg)] transition hover:border-[color:var(--accent)]",
                compact ? "h-9 min-w-24 px-4 text-sm" : "h-10 min-w-28 px-5 text-sm"
              )}
              onClick={(event) => event.stopPropagation()}
            >
              Detail
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
