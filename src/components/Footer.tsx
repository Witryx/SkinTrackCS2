export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[color:var(--border)]">
      <div className="container-max py-6 text-sm text-[color:var(--muted)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} SkinTrack CS2</p>
        <p>
          Vyrobil s radosti{" "}
          <a
            className="link"
            href="https://github.com/Witryx"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}

