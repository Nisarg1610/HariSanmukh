'use client';

import Link from 'next/link';

export default function LinksPage() {
  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>General Links</h1>
          <Link
            href="/"
            className="text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)', border: '0.5px solid var(--border-color)' }}
          >
            Back
          </Link>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Aarti &amp; Pooja Thal
          </p>
          <div className="grid grid-cols-1 gap-3">
            <a
              href="https://youtu.be/gOe1zn4Nvrc"
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-2xl px-4 py-4 font-semibold transition-all"
              style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent-text)', border: '0.5px solid var(--border-color)' }}
            >
              Maha Aarti
            </a>
            <a
              href="https://youtu.be/1nSItb3D97Q?si=FTekfmkJrmUGSgSA"
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-2xl px-4 py-4 font-semibold transition-all"
              style={{ backgroundColor: 'var(--yellow-bg)', color: 'var(--yellow)', border: '0.5px solid var(--border-color)' }}
            >
              Pooja Thal
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

