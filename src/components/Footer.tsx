export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-10">
      <div className="container-max py-6 text-sm text-[color:var(--muted)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} SkinTrack CS2</p>
        <p>
          Vyrobil s ❤️ pro ročníkovku.{" "}
          <a className="link" href="https://github.com/Witryx/SkinTrackCS2" target="_blank">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
