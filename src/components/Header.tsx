import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--bg)]/80 backdrop-blur">
      <div className="container-max h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image
            src="/logo.png" 
            alt="SkinTrack CS2 Logo"
            width={32}
            height={32}
            className="rounded-md"
          />
          <span>SkinTrack CS2</span>
        </Link>

        {}
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm hover:bg-white/5 transition"
          >
            Domů
          </Link>
          <Link
            href="/explorer"
            className="rounded-lg px-3 py-2 text-sm hover:bg-white/5 transition"
          >
            Explorer
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
