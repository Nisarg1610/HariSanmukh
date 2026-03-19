'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LogOut } from 'lucide-react';
import { getSevaAssignments } from '@/utils/seva';
import { getLaundryAssignments } from '@/utils/laundry';
import { registerPushNotifications } from '@/utils/pushNotifications';
import {
  browserSupportsWebAuthn,
  registerPasskey,
  authenticateWithPasskey,
  saveLastActive,
  clearLastActive,
  saveUserId,
  getSavedUserId,
  clearUserId,
  isSessionExpired,
} from '@/utils/webauthn';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mySevas, setMySevas] = useState<any[]>([]);
  const [myLaundryDays, setMyLaundryDays] = useState<string[]>([]);
  const [garbageDates, setGarbageDates] = useState<any[]>([]);
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;
  const visibilityTimer = useRef<NodeJS.Timeout | null>(null);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
const [registeringPasskey, setRegisteringPasskey] = useState(false);
const passkeyRegistrationRef = useRef(false); // prevent double call
const [biometricAvailable, setBiometricAvailable] = useState(false);

  // ── Helper: register passkey + mark done ──────────────────
 const tryRegisterPasskey = async (userId: string, email: string) => {
  if (!browserSupportsWebAuthn()) return;
  if (passkeyRegistrationRef.current) return; // prevent double call

  // Check localStorage
  const localCheck = localStorage.getItem(`hs_passkey_${userId}`);
  if (localCheck) return;

  // Check Supabase
  const { data: existingPasskey } = await supabase
    .from('passkeys')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingPasskey) {
    localStorage.setItem(`hs_passkey_${userId}`, 'true');
    return;
  }

  // ✅ Don't register automatically — show prompt instead
  setShowPasskeyPrompt(true);
};

  // ── setupProfile — untouched login/insert logic ───────────
  const setupProfile = async (authUser: any) => {
    try {
      console.log('setupProfile called for:', authUser.email);

      const { data: anyHousehold, error: hErr1 } = await supabase
        .from('households')
        .select('id')
        .limit(1)
        .maybeSingle();
      console.log('anyHousehold:', anyHousehold, 'error:', hErr1);

      const { data: existingMember, error: mErr } = await supabase
        .from('household_members')
        .select('*')
        .eq('email', authUser.email.toLowerCase())
        .maybeSingle();
      console.log('existingMember:', existingMember, 'error:', mErr);

      let householdId: string;
      let role: 'admin' | 'user' = 'user';
      let firstName = '';

      if (!anyHousehold) {
        console.log('no household — creating first admin');
        firstName = authUser.email.split('@')[0];
        const { data: household, error: hErr } = await supabase
          .from('households')
          .insert({ name: 'Main Household', created_by: authUser.id })
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
        console.log('existing member found:', existingMember);
        householdId = existingMember.household_id;
        firstName = existingMember.first_name?.trim() || authUser.email.split('@')[0];
        await supabase
          .from('household_members')
          .update({ linked_user_id: authUser.id })
          .eq('email', authUser.email.toLowerCase());
      } else {
        const { data: household } = await supabase
          .from('households')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (!household) throw new Error('No household found');
        householdId = household.id;
        firstName = authUser.email.split('@')[0];
        const { error: memberErr } = await supabase
          .from('household_members')
          .insert({
            household_id: householdId,
            first_name: firstName,
            last_name: 'Bhai',
            email: authUser.email.toLowerCase(),
            status: 'active',
            linked_user_id: authUser.id,
          });
        if (memberErr) {
          console.log('household_members insert error:', memberErr);
          throw memberErr;
        }
        console.log('member card created successfully');
      }

      console.log('inserting into users:', { firstName, householdId, role });
      const { error: uErr } = await supabase.from('users').insert({
        id: authUser.id,
        email: authUser.email,
        first_name: firstName,
        last_name: 'Bhai',
        household_id: householdId!,
        role,
        status: 'active',
      });
      if (uErr) {
        console.log('users insert error:', uErr);
        throw uErr;
      }

      const { data: newDbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      console.log('newDbUser:', newDbUser);
      setDbUser(newDbUser);

      // ✅ Save userId + lastActive + register passkey for NEW users
      saveUserId(authUser.id);
      saveLastActive();
      await tryRegisterPasskey(authUser.id, authUser.email);

    } catch (err: any) {
      console.error('setupProfile error:', err);
      setError(err.message ?? 'Setup failed');
    }
  };
const handleSetupPasskey = async () => {
  if (!dbUser || !user) return;
  if (passkeyRegistrationRef.current) return;

  try {
    passkeyRegistrationRef.current = true; // lock
    setRegisteringPasskey(true);

    const registered = await registerPasskey(dbUser.id, user.email!);
    if (registered) {
      localStorage.setItem(`hs_passkey_${dbUser.id}`, 'true');
      setShowPasskeyPrompt(false);
      console.log('Passkey registered!');
    } else {
      console.log('Passkey registration failed');
    }
  } finally {
    setRegisteringPasskey(false);
    passkeyRegistrationRef.current = false;
  }
};
  // ── fetchDashboardData ────────────────────────────────────
  const fetchDashboardData = async (hId: string, userEmail: string) => {
    const { data: memberCard } = await supabase
      .from('household_members')
      .select('id, first_name')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();

    if (!memberCard) return;

    const [assignments, laundryAssignments] = await Promise.all([
      getSevaAssignments(hId),
      getLaundryAssignments(hId),
    ]);

    const mine = assignments.filter(
      (a: any) => a.member_id === memberCard.id && !a.is_completed
    );
    setMySevas(mine);

    const myDays = laundryAssignments
      .filter((a: any) => a.member_id === memberCard.id)
      .map((a: any) => a.day_of_week);
    setMyLaundryDays(myDays);

    try {
      const calRes = await fetch('/api/garbage-calendar');
      const calData = await calRes.json();
      setGarbageDates(calData.events ?? []);
    } catch {
      setGarbageDates([]);
    }
  };

  // ── Visibility change — expire session after 2 min background ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        visibilityTimer.current = setTimeout(() => {
          clearLastActive();
        }, 2 * 60 * 1000);
      } else {
        if (visibilityTimer.current) {
          clearTimeout(visibilityTimer.current);
          visibilityTimer.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
    };
  }, []);

  // ── Main auth useEffect ───────────────────────────────────
useEffect(() => {
  let profileSetupDone = false;

  const init = async () => {
    try {
      const savedUserId = getSavedUserId();
      const passkeyRegistered = savedUserId
        ? localStorage.getItem(`hs_passkey_${savedUserId}`)
        : null;

      if (savedUserId && passkeyRegistered && browserSupportsWebAuthn()) {
        setBiometricAvailable(true);
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data) {
          setDbUser(data);
          saveUserId(session.user.id);
          await fetchDashboardData(data.household_id, session.user.email!);
          await registerPushNotifications(data.id, data.household_id);
        } else if (!profileSetupDone) {
          profileSetupDone = true;
          await setupProfile(session.user);
        }
      }
    } catch (err) {
      console.error('init error:', err);
    } finally {
      setLoading(false);
    }
  };

  init();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setDbUser(null);
        clearUserId();
        setBiometricAvailable(false);
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

  // ── Handlers ──────────────────────────────────────────────
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

const handleBiometricLogin = async () => {
  const savedUserId = getSavedUserId();
  if (!savedUserId) return;

  try {
    setBiometricLoading(true);
    setError(null);

    const verified = await authenticateWithPasskey(savedUserId);

    if (verified) {
      // Session should still exist — just fetch user data
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data) {
          setDbUser(data);
          await fetchDashboardData(data.household_id, session.user.email!);
        }
      } else {
        // Supabase session expired (after weeks) — need Google login
        setError('Your session has fully expired. Please sign in with Google once.');
        setBiometricAvailable(false);
        clearUserId();
      }
    } else {
      const newAttempts = biometricAttempts + 1;
      setBiometricAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setBiometricAvailable(false);
        setError('Too many failed attempts. Please sign in with Google.');
      } else {
        setError(`Verification failed. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
    }
  } finally {
    setBiometricLoading(false);
  }
};

const handleLogout = async () => {
  await supabase.auth.signOut();
  setUser(null);
  setDbUser(null);
  clearUserId();
  setBiometricAvailable(false);
  setBiometricAttempts(0);
};

  // ── Biometric screen ──────────────────────────────────────
  if (showBiometric) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-2">HariSanmukh</h1>
            <p className="text-gray-600 dark:text-gray-300">Welcome back</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"/>
                </svg>
              </div>
            </div>
            <p className="text-center text-gray-700 dark:text-gray-300 font-semibold mb-2">Verify your identity</p>
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">Use Face ID or fingerprint to continue</p>
            {biometricAttempts > 0 && (
              <div className="flex justify-center gap-2 mb-4">
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < biometricAttempts ? 'bg-red-500' : 'bg-gray-200 dark:bg-slate-600'}`} />
                ))}
              </div>
            )}
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all mb-4 disabled:opacity-50"
            >
              {biometricLoading ? <span>Verifying...</span> : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"/>
                  </svg>
                  Use Face ID / Fingerprint
                </>
              )}
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            </div>
            <button
              onClick={() => { setShowBiometric(false); setError(null); }}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2"
            >
              Sign in with Google instead
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  // ── Not logged in ─────────────────────────────────────────
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

          {/* Biometric button — only if passkey registered on this device */}
          {biometricAvailable && (
            <>
              <button
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all mb-4 disabled:opacity-50"
              >
                {biometricLoading ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"/>
                    </svg>
                    Login with Face ID / Fingerprint
                  </>
                )}
              </button>

              {/* Attempt dots */}
              {biometricAttempts > 0 && (
                <div className="flex justify-center gap-2 mb-4">
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${
                        i < biometricAttempts ? 'bg-red-500' : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              </div>
            </>
          )}

          {/* Google Sign In */}
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
  // ── Dashboard ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-28">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-30"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HariSanmukh</h1>
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={22} />
          </button>
        </div>
      </header>
      {/* Passkey setup prompt */}
{showPasskeyPrompt && (
  <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
    <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          Enable Face ID / Fingerprint login
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Skip Google next time — use biometrics instead
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => {
            localStorage.setItem(`hs_passkey_skip_${dbUser?.id}`, 'true');
            setShowPasskeyPrompt(false);
          }}
          className="text-xs text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
        >
          Not now
        </button>
        <button
          onClick={handleSetupPasskey}
          disabled={registeringPasskey}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
        >
          {registeringPasskey ? 'Setting up...' : 'Enable'}
        </button>
      </div>
    </div>
  </div>
)}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-orange-500 dark:text-orange-400 mb-1">🙏 Jay Swaminarayan</p>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{dbUser?.first_name} Bhai 👋</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's what you have this week</p>
          {dbUser?.role === 'admin' && (
            <span className="inline-block mt-2 bg-blue-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Admin</span>
          )}
        </div>

        {/* My Seva */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🙏</span>
            <h3 className="font-bold text-gray-900 dark:text-white">My Seva</h3>
          </div>
          {mySevas.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 text-sm">No seva assigned</p>
          ) : (
            <div className="space-y-2">
              {mySevas.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-1">
                  <span className="text-gray-900 dark:text-white font-medium text-sm">{a.sevas?.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.is_completed
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {a.is_completed ? 'Done ✓' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Laundry */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">👕</span>
            <h3 className="font-bold text-gray-900 dark:text-white">My Laundry Days</h3>
          </div>
          {myLaundryDays.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 text-sm">No laundry days assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myLaundryDays.map((day) => (
                <span key={day} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                  {day}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Garbage Collection */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🗑️</span>
            <h3 className="font-bold text-gray-900 dark:text-white">Garbage Collection</h3>
          </div>
          {garbageDates.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 text-sm">No upcoming dates</p>
          ) : (
            <div className="space-y-2">
              {garbageDates.map((event) => {
                const date = new Date(event.date + 'T00:00:00');
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={event.date}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 ${
                      isToday ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : isPast ? 'border-gray-100 dark:border-slate-800 opacity-50'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50'
                    }`}
                  >
                    <div className={`text-2xl font-bold w-10 text-center ${
                      isToday ? 'text-green-600 dark:text-green-400'
                      : isPast ? 'text-gray-400'
                      : 'text-gray-900 dark:text-white'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="w-px h-8 bg-gray-200 dark:bg-slate-600" />
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${isToday ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>
                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-right max-w-24">{event.title}</span>
                    {isToday && <span className="text-xs bg-green-500 text-white font-semibold px-2 py-0.5 rounded-full">Today</span>}
                    {isPast && !isToday && <span className="text-xs text-gray-400">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav isAdmin={dbUser?.role === 'admin'} />
    </main>
  );
}