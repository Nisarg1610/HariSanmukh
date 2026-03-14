'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LogOut } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        if (authUser) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (dbUser) {
            setUserRole(dbUser.role);
            setUserExists(true);
          } else {
            setUserExists(false);
          }
        }
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        setUserExists(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setSigningIn(true);
      setError(null);

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`,
        },
      });

      if (signInError) throw signInError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSigningIn(false);
    }
  };

  const handleSetupProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (!user) {
      setError('Not authenticated');
      return;
    }

    try {
      setSavingProfile(true);
      setError(null);

      const { data: household } = await supabase
        .from('households')
        .insert({
          name: `${formData.firstName}'s Household`,
          created_by: user.id,
        })
        .select()
        .single();

      if (!household) throw new Error('Failed to create household');

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          household_id: household.id,
          role: 'admin',
          status: 'active',
        });

      if (userError) throw userError;

      setUserExists(true);
      setUserRole('admin');
      setFormData({ firstName: '', lastName: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserExists(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  // Not logged in - Show login
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3">
              HariSanmukh
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Manage household duties together
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full bg-white dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 rounded-xl px-6 py-4 font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Logged in but no profile - Show setup
  if (userExists === false) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3">
              HariSanmukh
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Complete your profile
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSetupProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                {savingProfile ? 'Setting up...' : 'Continue'}
              </button>
            </form>

            <button
              onClick={handleLogout}
              className="w-full mt-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              Use different account
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Logged in with profile - Show dashboard
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            HariSanmukh
          </h1>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {user.email}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
              My Sevas
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-2xl p-6 border border-green-200 dark:border-green-800">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Completed
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">0</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Members
            </h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">1</p>
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Getting Started
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start by creating sevas, adding grocery items, or inviting household members.
          </p>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ✓ Create household sevas
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ✓ Manage grocery lists
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ✓ Track laundry duties
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ✓ Invite family members
            </p>
          </div>
        </div>
      </div>

      <BottomNav isAdmin={userRole === 'admin'} />
    </main>
  );
}