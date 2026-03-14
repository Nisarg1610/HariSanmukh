'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CheckCircle,
  ShoppingCart,
  Shirt,
  Users,
} from 'lucide-react';

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
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 z-40">
      <div className="max-w-2xl mx-auto px-0">
        <div className="flex justify-around items-center h-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-20 transition-all duration-200 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}