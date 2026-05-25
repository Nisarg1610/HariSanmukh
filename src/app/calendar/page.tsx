'use client';
import { BottomNav } from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CalendarPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = '/'; return; }
      const { data: dbUser } = await supabase
        .from('users').select('role').eq('id', session.user.id).maybeSingle();
      if (dbUser) setIsAdmin(dbUser.role === 'admin');
    };
    init();
  }, []);

  return (
    <main
      className="min-h-screen flex flex-col app-page"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: '0.5px solid var(--separator)' }}
      >
       <div className="w-8 h-8 rounded-xl flex items-center justify-center"
  style={{ backgroundColor: 'var(--yellow-bg)' }}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
</div>
        <div>
          <h1 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>
            HariPrabodham Calendar
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            iHariPrabodham 2026
          </p>
        </div>
      </div>

      {/* iframe */}
      <iframe
        src="https://www.ihariprabodham.org/calendar2026"
        className="flex-1 w-full border-none"
        style={{ height: 'calc(100dvh - 130px)' }}
        title="Swaminarayan Calendar 2026"
        allow="same-origin"
      />

      <BottomNav isAdmin={isAdmin} />
    </main>
  );
}