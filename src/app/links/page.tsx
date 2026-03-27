'use client';

import { BottomNav } from '@/components/BottomNav';
import Link from 'next/link';

export default function LinksPage() {
  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>General Info</h1>
          
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

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            House Details
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div
              className="w-full rounded-2xl px-4 py-4 transition-all flex flex-col"
              style={{ backgroundColor: 'var(--bg-card-2)', border: '0.5px solid var(--border-color)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Wi-Fi</p>
              <p className="font-extrabold text-[16px]" style={{ color: 'var(--text-1)' }}>Gunatit</p>
              <p className="text-[14px] font-medium mt-1" style={{ color: 'var(--text-2)' }}>Pass: Dasnadas@369</p>
            </div>
            
            <div
              className="w-full rounded-2xl px-4 py-4 transition-all flex flex-col"
              style={{ backgroundColor: 'var(--bg-card-2)', border: '0.5px solid var(--border-color)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>House Lock</p>
              <p className="font-extrabold text-[16px]" style={{ color: 'var(--text-1)' }}>Front Door</p>
              <p className="text-[20px] font-mono font-medium mt-1 tracking-widest" style={{ color: 'var(--text-2)' }}>••••</p>
            </div>
          </div>
        </div>
      </div>
      <BottomNav isAdmin={true} />
    </main>
  );
}

