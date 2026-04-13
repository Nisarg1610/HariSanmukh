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
    { href: '/', icon: Home },
    { href: '/grocery', icon: ShoppingCart },
    { href: '/calendar', icon: Calendar },
    ...(isAdmin ? [{ href: '/members', icon: Users }] : []),
  ];

  return (
    <div className="glass-bottom fixed bottom-0 left-0 right-0 z-40">
      <nav
        className="flex items-center justify-around"
        style={{ paddingTop: '10px' }}
      >
        {navItems.map(({ href, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center"
              style={{
                minWidth: '56px',
                paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '2.5px',
                    borderRadius: '2px',
                    background: 'var(--accent)',
                  }}
                />
              )}
              <Icon
                size={24}
                strokeWidth={isActive ? 2.2 : 1.8}
                stroke={isActive ? 'var(--accent)' : 'var(--text-3)'}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}