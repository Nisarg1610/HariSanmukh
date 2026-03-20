'use client';

import { useState, useEffect } from 'react';
import { ProfilePanel } from '@/components/ProfilePanel';

interface AppHeaderProps {
  user?: any;
  dbUser?: any;
  onLogout?: () => void;
}

export function AppHeader({ user, dbUser, onLogout }: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className="sticky top-0 z-30 transition-all duration-300"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: scrolled ? 'var(--bg-card)' : 'transparent',
          backdropFilter: scrolled ? 'saturate(180%) blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(20px)' : 'none',
          borderBottom: scrolled ? '0.5px solid var(--separator)' : 'none',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/icon-192.png" alt="HariSanmukh" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
              HariSanmukh
            </h1>
          </div>

          {user && (
            <button
              onClick={() => setProfileOpen(true)}
              className="w-9 h-9 rounded-full overflow-hidden transition-all"
              style={{ border: '2px solid var(--border-strong)' }}
            >
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={dbUser?.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <span className="text-white text-sm font-bold">
                    {dbUser?.first_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </button>
          )}
        </div>
      </header>

      {user && onLogout && (
        <ProfilePanel
          user={user}
          dbUser={dbUser}
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          onLogout={() => { setProfileOpen(false); onLogout(); }}
          onSwitchAccount={() => { setProfileOpen(false); onLogout(); }}
        />
      )}
    </>
  );
}