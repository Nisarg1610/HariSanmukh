'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';

export default function LaundryPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          window.location.href = '/';
          return;
        }

        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (dbUser) {
          setUserRole(dbUser.role);
        }

        setUser(authUser);
      } catch (err) {
        console.error('Auth error:', err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Laundry
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Coming soon...
        </p>
      </div>
      <BottomNav isAdmin={userRole === 'admin'} />
    </main>
  );
}