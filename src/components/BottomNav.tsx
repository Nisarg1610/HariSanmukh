'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Users, Calendar } from 'lucide-react';

interface BottomNavProps {
  isAdmin: boolean;
}

const ACCENT = '#5B6EF5'; // swap to your brand color

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home },
    { href: '/grocery', icon: ShoppingCart },
    { href: '/calendar', icon: Calendar },
    ...(isAdmin ? [{ href: '/members', icon: Users }] : []),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <nav
        className="flex items-center justify-around"
        style={{
          background: 'var(--bg-card)',
          borderTop: '0.5px solid var(--border-color)',
          paddingTop: '10px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        }}
      >
        {navItems.map(({ href, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center pb-1"
              style={{ minWidth: '56px' }}
            >
              <Icon
                size={24}
                strokeWidth={isActive ? 0 : 1.8}
                fill={isActive ? ACCENT : 'none'}
                stroke={isActive ? 'none' : 'var(--text-3)'}
              />
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: ACCENT,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}