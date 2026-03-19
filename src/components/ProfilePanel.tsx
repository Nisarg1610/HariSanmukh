'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, RefreshCw, Bell, Moon, Sun, X, ChevronRight } from 'lucide-react';

interface ProfilePanelProps {
  user: any;
  dbUser: any;
  onLogout: () => void;
  onSwitchAccount: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export function ProfilePanel({
  user, dbUser, onLogout, onSwitchAccount, onClose, isOpen
}: ProfilePanelProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Check dark mode on mount
useEffect(() => {
  const savedTheme = localStorage.getItem('hs_theme');
  if (savedTheme) {
    setDarkMode(savedTheme === 'dark');
  } else {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }
}, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
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

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      // Can't programmatically disable — tell user
      alert('To disable notifications, go to your browser settings.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const firstName = dbUser?.first_name ?? '';
  const email = user?.email ?? '';

  if (!isOpen) return null;

 return (
  <>
    {/* Backdrop */}
    <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />

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
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '0.5px solid var(--separator)' }}
      >
        <span className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Profile</span>
        <button
          onClick={onClose}
          className="p-2 rounded-xl transition-all"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-2)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
        </button>
      </div>

      {/* Profile section */}
      <div
        className="px-5 py-6"
        style={{ borderBottom: '0.5px solid var(--separator)' }}
      >
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={firstName}
              className="w-16 h-16 rounded-full object-cover"
              style={{ border: '2px solid var(--border-strong)' }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--accent)',
                border: '2px solid var(--border-strong)',
              }}
            >
              <span className="text-2xl font-bold text-white">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate" style={{ color: 'var(--text-1)' }}>
              {firstName} Bhai
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
              : <Sun size={18} style={{ color: 'var(--yellow)' }} />
            }
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              {darkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <button
            onClick={handleToggleDarkMode}
            className={`toggle ${darkMode ? 'on' : ''}`}
            style={darkMode ? { background: 'var(--accent)' } : undefined}
          >
            <div className="toggle-thumb" />
          </button>
        </div>

        {/* Notifications */}
        <div
          className="flex items-center justify-between py-3.5 px-4 rounded-2xl"
          style={{ backgroundColor: 'var(--bg-card-2)' }}
        >
          <div className="flex items-center gap-3">
            <Bell
              size={18}
              style={{ color: notificationsEnabled ? 'var(--green)' : 'var(--text-4)' }}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              Notifications
            </span>
          </div>
          <button
            onClick={handleToggleNotifications}
            className={`toggle ${notificationsEnabled ? 'on' : ''}`}
          >
            <div className="toggle-thumb" />
          </button>
        </div>

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
              Switch Account
            </span>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-4)' }} />
        </button>

        {/* Logout */}
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
              Sign Out
            </span>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--red)', opacity: 0.5 }} />
        </button>
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3"
        style={{ borderTop: '0.5px solid var(--separator)' }}
      >
        <p className="text-xs text-center" style={{ color: 'var(--text-4)' }}>
          HariSanmukh v1.0 · Made with 🙏
        </p>
      </div>
    </div>
  </>
);
}