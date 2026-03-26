'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { LogOut, RefreshCw, Bell, BellOff, Moon, Sun, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfilePanelProps {
  user: any;
  dbUser: any;
  displayName: string;      // from household_members — admin-editable
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

// ─── Notification permission states and what they mean ────────────────────────
// 'granted'  → push works, toggle is ON,  user can turn it OFF (unsubscribes from DB)
// 'denied'   → push blocked, toggle is OFF, user must go to device settings
// 'default'  → never asked, toggle is OFF, we can request permission
// unsupported → browser/device doesn't support push at all, hide the toggle

type NotifState = 'granted' | 'denied' | 'default' | 'unsupported';

function getNotifState(): NotifState {
  if (typeof window === 'undefined')           return 'unsupported';
  if (!('Notification' in window))             return 'unsupported';
  if (!('serviceWorker' in navigator))         return 'unsupported';
  if (!('PushManager' in window))              return 'unsupported';
  return Notification.permission as NotifState;
}

export function ProfilePanel({
  user, dbUser, displayName,
  isOpen, onClose, onLogout, onSwitchAccount,
}: ProfilePanelProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [notifState, setNotifState]         = useState<NotifState>('default');
  const [notifLoading, setNotifLoading]     = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [darkMode, setDarkMode]             = useState(false);
  const panelRef                            = useRef<HTMLDivElement>(null);

  // ── Sync notification state on every open ─────────────────────────────────
  // We re-read permission each time the panel opens because the user may have
  // changed it in device settings while the app was open.
  useEffect(() => {
    if (!isOpen) return;
    setNotifState(getNotifState());
    setShowNotifPopup(false); // always reset popup on open — never show it automatically
  }, [isOpen]);

  // ── Sync dark mode on mount ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('hs_theme');
    if (saved) {
      setDarkMode(saved === 'dark');
    } else {
      setDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // ── Prevent body scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else        document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Dark mode toggle ──────────────────────────────────────────────────────
  const handleToggleDarkMode = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hs_theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hs_theme', 'dark');
      setDarkMode(true);
    }
  };

  // ── Notification toggle ───────────────────────────────────────────────────
  // Four scenarios handled cleanly:
  // 1. Unsupported  → do nothing (toggle is hidden)
  // 2. Granted      → locked ON (can't turn OFF in-app)
  // 3. Denied       → user wants to turn ON  → can't request, show instructions
  // 4. Default      → user wants to turn ON  → request permission
  const handleToggleNotifications = useCallback(async () => {
    const current = getNotifState();

    if (current === 'unsupported') return;

    if (current === 'granted') {
      // Locked ON once allowed: don't offer in-app disable
      return;
    }

    if (current === 'denied') {
      // ── Blocked: can't request — show instructions popup ─────────────────
      setShowNotifPopup(true);
      return;
    }

    // ── Default: request permission ───────────────────────────────────────
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotifState('granted');
        // Re-register push subscription now that permission is granted
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && dbUser?.household_id) {
          // Dynamically import to avoid SSR issues
          const { registerPushNotifications } = await import('@/utils/pushNotifications');
          await registerPushNotifications(session.user.id, dbUser.household_id);
        }
      } else if (permission === 'denied') {
        setNotifState('denied');
        setShowNotifPopup(true);
      }
    } catch (err) {
      console.error('Failed to request notification permission:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [dbUser]);

  // ── Don't render when closed ──────────────────────────────────────────────
  if (!isOpen) return null;

  const avatarUrl  = user?.user_metadata?.avatar_url;
  const email      = user?.email ?? '';
  const isEnabled  = notifState === 'granted';
  const isSupported = notifState !== 'unsupported';
  const notifLockedOn = notifState === 'granted';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      />

      {/* Side panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: '320px',
          maxWidth: '85vw',
          backgroundColor: 'var(--bg-card)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 0 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '0.5px solid var(--separator)' }}
        >
          <span className="font-bold text-base" style={{ color: 'var(--text-1)' }}>
            Profile
          </span>
          <button
            onClick={onClose}
            aria-label="Close profile menu"
            className="p-2 rounded-xl transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Avatar + name */}
        <div
          className="px-5 py-5 flex-shrink-0"
          style={{ borderBottom: '0.5px solid var(--separator)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: '2px solid var(--border-strong)' }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <span className="text-2xl font-bold text-white">
                    {displayName?.charAt(0).toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate" style={{ color: 'var(--text-1)' }}>
                {displayName} Bhai
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
                {email}
              </p>
              {dbUser?.role === 'admin' && (
                <span
                  className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent-text)' }}
                >
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">

          {/* Dark mode */}
          <div
            className="flex items-center justify-between py-3.5 px-4 rounded-2xl"
            style={{ backgroundColor: 'var(--bg-card-2)' }}
          >
            <div className="flex items-center gap-3">
              {darkMode
                ? <Moon size={18} style={{ color: 'var(--accent)' }} />
                : <Sun  size={18} style={{ color: 'var(--yellow)' }} />
              }
              <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                {darkMode ? 'Dark mode' : 'Light mode'}
              </span>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`toggle ${darkMode ? 'on' : ''}`}
              style={darkMode ? { background: 'var(--accent)' } : undefined}
              aria-label="Toggle dark mode"
            >
              <div className="toggle-thumb" />
            </button>
          </div>

          {/* Notifications — only show if device supports push */}
          {isSupported && (
            <div
              className="flex items-center justify-between py-3.5 px-4 rounded-2xl"
              style={{ backgroundColor: 'var(--bg-card-2)' }}
            >
              <div className="flex items-center gap-3">
                {isEnabled
                  ? <Bell    size={18} style={{ color: 'var(--green)' }} />
                  : <BellOff size={18} style={{ color: 'var(--text-4)' }} />
                }
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                    Notifications
                  </span>
                  {/* Status label under the title */}
                  <p className="text-xs mt-0.5" style={{
                    color: notifState === 'denied'  ? 'var(--red)'   :
                           notifState === 'granted' ? 'var(--green)' :
                           'var(--text-4)'
                  }}>
                    {notifState === 'granted' ? 'Enabled (locked)'
                   : notifState === 'denied'  ? 'Blocked in settings'
                   :                            'Tap to enable'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleNotifications}
                disabled={notifLoading || notifLockedOn}
                className={`toggle ${isEnabled ? 'on' : ''} disabled:opacity-50`}
                style={isEnabled ? { background: 'var(--green)' } : undefined}
                aria-label="Toggle notifications"
              >
                <div className="toggle-thumb" />
              </button>
            </div>
          )}

          <div style={{ paddingTop: 8 }} />

          {/* Switch account */}
          <button
            onClick={onSwitchAccount}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl transition-all"
            style={{ backgroundColor: 'var(--bg-card-2)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-bg)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-2)')}
          >
            <div className="flex items-center gap-3">
              <RefreshCw size={18} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Switch account
              </span>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-4)' }} />
          </button>

          {/* Sign out */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl transition-all"
            style={{ backgroundColor: 'var(--red-bg)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} style={{ color: 'var(--red)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
                Sign out
              </span>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--red)', opacity: 0.5 }} />
          </button>

        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex-shrink-0"
          style={{ borderTop: '0.5px solid var(--separator)' }}
        >
          <p className="text-xs text-center" style={{ color: 'var(--text-4)' }}>
            HariSanmukh v1.0 · Made with 🙏
          </p>
        </div>
      </div>

      {/* Notification instructions popup */}
      {/* Only shown when user taps toggle and permission is denied */}
      {showNotifPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-8"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowNotifPopup(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--yellow-bg)' }}
                >
                  <BellOff size={20} style={{ color: 'var(--yellow)' }} />
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>
                    Notifications blocked
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    Allow in device settings to continue
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifPopup(false)}
                className="p-1 rounded-lg"
                style={{ color: 'var(--text-4)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              You'll miss reminders for seva, laundry and garbage collection.
              Here's how to turn them back on:
            </p>

            {/* Instructions */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ backgroundColor: 'var(--bg-card-2)' }}
            >
              {[
                { platform: 'iPhone / iPad', steps: 'Settings → HariSanmukh → Notifications → Allow' },
                { platform: 'Android',       steps: 'Settings → Apps → HariSanmukh → Notifications → On' },
                { platform: 'Chrome',        steps: 'Tap the lock icon in address bar → Notifications → Allow' },
              ].map(({ platform, steps }) => (
                <div key={platform}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-1)' }}>
                    {platform}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{steps}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowNotifPopup(false)}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--accent)', color: 'white' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}