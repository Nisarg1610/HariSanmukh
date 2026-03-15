'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LogOut } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');

 useEffect(() => {
  const init = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (data) {
          setDbUser(data);
        } else {
          // No profile yet — auto create without asking for name
          await handleSetupProfile(session.user);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  init();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setDbUser(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (data) {
          setDbUser(data);
        } else {
          await handleSetupProfile(session.user);
        }
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

  const handleGoogleLogin = async () => {
    try {
      setSigningIn(true);
      setError(null);
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/` },
      });
      if (e) throw e;
    } catch (err: any) {
      setError(err.message ?? 'Sign in failed');
      setSigningIn(false);
    }
  };

 const handleSetupProfile = async (authUser: any) => {
  try {
    setSavingProfile(true);
    setError(null);

    const { data: anyHousehold } = await supabase
      .from('households')
      .select('id')
      .limit(1)
      .single();

    const { data: existingMember } = await supabase
      .from('household_members')
      .select('*')
      .eq('email', authUser.email.toLowerCase())
      .single();

    let householdId: string;
    let role: 'admin' | 'user' = 'user';
    let firstName = existingMember?.first_name ?? authUser.email.split('@')[0];

    if (!anyHousehold) {
      // First ever user — admin
      const { data: household, error: hErr } = await supabase
        .from('households')
        .insert({ name: `Main Household`, created_by: authUser.id })
        .select()
        .single();
      if (hErr || !household) throw hErr ?? new Error('Household creation failed');
      householdId = household.id;
      role = 'admin';

      await supabase.from('household_members').insert({
        household_id: householdId,
        first_name: firstName,
        last_name: 'Bhai',
        email: authUser.email.toLowerCase(),
        status: 'active',
        linked_user_id: authUser.id,
      });

    } else if (existingMember) {
      // Pre-added by admin — link to existing card
      householdId = existingMember.household_id;
      await supabase
        .from('household_members')
        .update({ linked_user_id: authUser.id })
        .eq('id', existingMember.id);

    } else {
      // New person — auto create member card
      const { data: household } = await supabase
        .from('households')
        .select('id')
        .limit(1)
        .single();
      householdId = household!.id;

      await supabase.from('household_members').insert({
        household_id: householdId,
        first_name: firstName,
        last_name: 'Bhai',
        email: authUser.email.toLowerCase(),
        status: 'active',
        linked_user_id: authUser.id,
      });
    }

    const { error: uErr } = await supabase.from('users').insert({
      id: authUser.id,
      email: authUser.email,
      first_name: firstName,
      last_name: 'Bhai',
      household_id: householdId,
      role,
      status: 'active',
    });
    if (uErr) throw uErr;

    const { data: newDbUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    setDbUser(newDbUser);
    window.location.href = '/';
  } catch (err: any) {
    setError(err.message ?? 'Setup failed');
  } finally {
    setSavingProfile(false);
  }
};
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDbUser(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  // ─── NOT LOGGED IN ───────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
              HariSanmukh
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage household duties together
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl px-6 py-4 font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {signingIn ? 'Redirecting...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      </main>
    );
  }



  // ─── DASHBOARD ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-28">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            HariSanmukh
          </h1>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          Welcome, {dbUser.first_name} Bhai 👋
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          {user.email}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              My Sevas
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">—</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Completed
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">—</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Members
            </p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">—</p>
          </div>
        </div>

        {/* Role badge + getting started */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white">
              Getting Started
            </h3>
            {dbUser.role === 'admin' && (
              <span className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use the navigation below to manage sevas, grocery, laundry
            {dbUser.role === 'admin' ? ', and members.' : '.'}
          </p>
        </div>
      </div>

      <BottomNav isAdmin={dbUser.role === 'admin'} />
    </main>
  );
}