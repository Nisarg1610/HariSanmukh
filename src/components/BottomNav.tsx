'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CheckCircle, ShoppingCart, Shirt, Users } from 'lucide-react';

interface BottomNavProps {
  isAdmin: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/seva', label: 'Seva', icon: CheckCircle },
    { href: '/grocery', label: 'Grocery', icon: ShoppingCart },
    { href: '/laundry', label: 'Laundry', icon: Shirt },
    ...(isAdmin ? [{ href: '/members', label: 'Members', icon: Users }] : []),
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <nav
        className="flex items-center gap-1 px-3 py-2 rounded-full"
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '0.5px solid var(--border-strong)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 transition-all duration-200"
              style={{
                padding: '8px 14px',
                borderRadius: '999px',
                minWidth: '60px',
                backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                border: isActive
                  ? '0.5px solid var(--border-color)'
                  : '0.5px solid transparent',
              }}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)' }}
              />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent)' : 'var(--text-3)',
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