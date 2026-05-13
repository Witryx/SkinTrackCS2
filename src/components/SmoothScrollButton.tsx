"use client";

type Props = {
  targetId: string;
  className?: string;
  children: React.ReactNode;
};

export default function SmoothScrollButton({
  targetId,
  className,
  children,
}: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const target = document.getElementById(targetId);
        if (!target) return;

        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        target.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });

        window.history.replaceState(null, "", `#${targetId}`);
      }}
    >
      {children}
    </button>
  );
}
