import type { Metadata } from "next";
import Link from "next/link";

// Served for any address that doesn't exist (out/404.html). Kept out of
// search results, with a way back into the site.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="shell policy-shell">
      <div className="room-light" aria-hidden />
      <article className="paper policy">
        <h1>File not found</h1>
        <p className="paper-meta">Error 404 · Stroop</p>

        <hr />

        <p>
          There is no record at this address. It may have been moved, or it
          never existed.
        </p>

        <div className="paper-actions">
          <Link className="act act-primary" href="/">
            ▸ Back to the game
          </Link>
          <Link className="act" href="/how-to-play">
            How to play
          </Link>
        </div>
      </article>
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </main>
  );
}
