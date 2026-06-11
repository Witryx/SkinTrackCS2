import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--border)]">
      <div className="container-max flex flex-col items-center justify-between gap-3 py-8 text-sm text-[color:var(--muted)] sm:flex-row">
        <p>SkinTrack CS2 / {new Date().getFullYear()}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link className="link" href="/privacy">
            Podmínky a privacy policy
          </Link>
          <a
            className="link"
            href="https://github.com/Witryx"
            target="_blank"
            rel="noreferrer"
          >
            Projekt GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
