'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Users, Calendar } from 'lucide-react';

interface BottomNavProps {
  isAdmin: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/grocery', label: 'Grocery', icon: ShoppingCart },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    ...(isAdmin ? [{ href: '/members', label: 'Members', icon: Users }] : []),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <nav
        className="flex items-end justify-around px-2"
        style={{
          background: 'var(--bg-card)',
          borderTop: '0.5px solid var(--border-color)',
          paddingTop: '10px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 relative"
              style={{ minWidth: '56px', paddingTop: '6px' }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '32px',
                    height: '3px',
                    borderRadius: '2px',
                    background: 'var(--text-1)',
                  }}
                />
              )}
              <Icon
                size={24}
                strokeWidth={isActive ? 0 : 1.8}
                fill={isActive ? 'var(--text-1)' : 'none'}
                stroke={isActive ? 'none' : 'var(--text-3)'}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                  letterSpacing: '0.01em',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}