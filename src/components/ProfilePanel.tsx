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
    setDarkMode(document.documentElement.classList.contains('dark'));
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
    const isDark = document.documentElement.classList.toggle('dark');
    setDarkMode(isDark);
    localStorage.setItem('hs_theme', isDark ? 'dark' : 'light');
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
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" />

      {/* Side panel — slides in from right */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-900 z-50 shadow-2xl flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <span className="font-bold text-gray-900 dark:text-white text-base">Profile</span>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile section */}
        <div className="px-5 py-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={firstName}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-900"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center ring-2 ring-blue-100 dark:ring-blue-900">
                <span className="text-2xl font-bold text-white">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white text-base truncate">
                {firstName} Bhai
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {email}
              </p>
              {dbUser?.role === 'admin' && (
                <span className="inline-block mt-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">

          {/* Dark mode toggle */}
          <div className="flex items-center justify-between py-3.5 px-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
            <div className="flex items-center gap-3">
              {darkMode
                ? <Moon size={18} className="text-blue-500" />
                : <Sun size={18} className="text-amber-500" />
              }
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                darkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                darkMode ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Notifications toggle */}
          <div className="flex items-center justify-between py-3.5 px-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <Bell size={18} className={notificationsEnabled ? 'text-green-500' : 'text-gray-400'} />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Notifications
              </span>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                notificationsEnabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-600'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Divider */}
          <div className="pt-2" />

          {/* Switch account */}
          <button
            onClick={onSwitchAccount}
            className="w-full flex items-center justify-between py-3.5 px-4 bg-gray-50 dark:bg-slate-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="text-blue-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Switch Account
              </span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between py-3.5 px-4 bg-red-50 dark:bg-red-900/20 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} className="text-red-500" />
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                Logout
              </span>
            </div>
            <ChevronRight size={16} className="text-red-400" />
          </button>
        </div>

        {/* App version */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            HariSanmukh v1.0
          </p>
        </div>
      </div>
    </>
  );
}