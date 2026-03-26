'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type DailyContent = {
  siksha: any;
  swamini: any;
} | null;

export default function SwadhyayPage() {
  const [dailyContent, setDailyContent] = useState<DailyContent>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/daily-content');
        const data = await res.json();
        setDailyContent(data);
      } catch (e) {
        console.error('Failed to fetch daily content', e);
        setDailyContent(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Swadhyay of the Day</h1>
          <Link
            href="/"
            className="text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)', border: '0.5px solid var(--border-color)' }}
          >
            Back
          </Link>
        </div>

        {loading ? (
          <div className="card p-5">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading...</p>
          </div>
        ) : !dailyContent ? (
          <div className="card p-5">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No content available.</p>
          </div>
        ) : (
          <>
            {/* Sikshapatri */}
            {dailyContent.siksha && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--accent-bg)' }}>
                    <span style={{ fontSize: 16 }}>📖</span>
                  </div>
                  <h2 className="font-bold" style={{ color: 'var(--text-1)' }}>Sikshapatri</h2>
                  {dailyContent.siksha.shloka_number && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--accent)' }}>
                      #{dailyContent.siksha.shloka_number}
                    </span>
                  )}
                </div>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-1)', lineHeight: '1.8' }}>
                  {dailyContent.siksha.gujarati_text}
                </p>
              </div>
            )}

            {/* Swamini Vato */}
            {dailyContent.swamini && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--yellow-bg)' }}>
                    <span style={{ fontSize: 16 }}>🪔</span>
                  </div>
                  <h2 className="font-bold" style={{ color: 'var(--text-1)' }}>Swamini Vato</h2>
                  {dailyContent.swamini.vat_number && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--accent)' }}>
                      #{dailyContent.swamini.vat_number}
                    </span>
                  )}
                </div>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-1)', lineHeight: '1.8' }}>
                  {dailyContent.swamini.gujarati_text}
                </p>
                {dailyContent.swamini.reference && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
                    {dailyContent.swamini.reference}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

