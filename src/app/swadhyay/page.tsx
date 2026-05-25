'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type DailyContent = {
  siksha: any;
  swamini: any;
} | null;

export default function SwadhyayPage() {
  const [dailyContent, setDailyContent] = useState<DailyContent>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
      className="min-h-screen pb-28 app-page"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Swadhyay of the Day</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">

        <section
          className="rounded-3xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(140deg, #f97316 0%, #fb923c 100%)' }}
        >
          <p className="text-xl font-extrabold">Swadhyay of the Day</p>
          <p className="text-sm font-medium text-white/85 mt-1">
            Read today&apos;s Sikshapatri and Swamini Vato.
          </p>
        </section>

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

