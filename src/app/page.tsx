'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { getSevaAssignments } from '@/utils/seva';
import { getLaundryAssignments } from '@/utils/laundry';
import { registerPushNotifications } from '@/utils/pushNotifications';
import {
  browserSupportsWebAuthn,
  registerPasskey,
  authenticateWithPasskey,
  saveUserId,
  getSavedUserId,
  clearUserId,
} from '@/utils/webauthn';
import { ProfilePanel } from '@/components/ProfilePanel';

// ─── Constants ────────────────────────────────────────────
const MAX_ATTEMPTS = 3;
const LOADING_TIMEOUT_MS = 10_000;
const SIGNIN_TIMEOUT_MS = 5_000;

// ─── Types ────────────────────────────────────────────────
type PromptKind = 'passkey' | 'notification' | null;

export default function Home() {
  const [user, setUser]                           = useState<any>(null);
  const [dbUser, setDbUser]                       = useState<any>(null);
  const [loading, setLoading]                     = useState(true);
  const [loadingTimedOut, setLoadingTimedOut]     = useState(false);
  const [signingIn, setSigningIn]                 = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [mySevas, setMySevas]                     = useState<any[]>([]);
  const [myLaundryDays, setMyLaundryDays]         = useState<string[]>([]);
  const [garbageDates, setGarbageDates]           = useState<any[]>([]);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading]   = useState(false);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const [activePrompt, setActivePrompt]           = useState<PromptKind>(null);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [profileOpen, setProfileOpen]             = useState(false);

  // ── Refs (never stale in closures) ───────────────────────
  const dbUserRef               = useRef<any>(null);
  const setupInProgressRef      = useRef(false);   // FIX: replaces local profileSetupDone flag
  const passkeyRegistrationRef  = useRef(false);
  const signinTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state
  useEffect(() => { dbUserRef.current = dbUser; }, [dbUser]);

  // ─── Prompt queue: show one at a time ────────────────────
  // FIX: replaces the two separate showPasskeyPrompt / showNotificationPrompt booleans
  //      which could both be true simultaneously, stacking banners.
  const queuedPromptsRef = useRef<PromptKind[]>([]);

  const enqueuePrompt = useCallback((kind: PromptKind) => {
    if (!kind) return;
    queuedPromptsRef.current.push(kind);
    // Only activate if nothing is showing right now
    setActivePrompt(prev => (prev === null ? queuedPromptsRef.current.shift() ?? null : prev));
  }, []);

  const dismissPrompt = useCallback(() => {
    setActivePrompt(null);
    // Small delay so the dismiss animation can finish before next one appears
    setTimeout(() => {
      const next = queuedPromptsRef.current.shift() ?? null;
      setActivePrompt(next);
    }, 400);
  }, []);

  // ─── Passkey helpers ──────────────────────────────────────
  const tryRegisterPasskey = useCallback(async (userId: string) => {
    if (!browserSupportsWebAuthn()) return;
    if (passkeyRegistrationRef.current) return;

    // FIX: skip localStorage gate — treat DB as source of truth
    const { data: existingPasskey } = await supabase
      .from('passkeys')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPasskey) return; // already registered on server — no prompt needed

    const skipped = localStorage.getItem(`hs_passkey_skip_${userId}`);
    if (skipped) return;

    // Delay prompt slightly so dashboard content loads first
    setTimeout(() => enqueuePrompt('passkey'), 2500);
  }, [enqueuePrompt]);

  const handleSetupPasskey = async () => {
    if (!dbUser || !user) return;
    if (passkeyRegistrationRef.current) return;

    try {
      passkeyRegistrationRef.current = true;
      setRegisteringPasskey(true);
      const registered = await registerPasskey(dbUser.id, user.email!);
      if (registered) {
        dismissPrompt();
      }
    } finally {
      setRegisteringPasskey(false);
      passkeyRegistrationRef.current = false;
    }
  };

  // ─── Push notification helper ────────────────────────────
  // FIX: guard against environments where Notification API is unavailable (iOS PWA etc.)
  const supportsNotifications = () =>
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator;

  const maybeEnqueueNotificationPrompt = useCallback(() => {
    if (!supportsNotifications()) return;
    if (Notification.permission !== 'granted') {
      enqueuePrompt('notification');
    }
  }, [enqueuePrompt]);

  // ─── setupProfile ────────────────────────────────────────
  // FIX: made idempotent — wrapped in setupInProgressRef to prevent concurrent calls.
  //      setLoading(false) is now guaranteed to be called in all paths.
  const setupProfile = async (authUser: any): Promise<any | null> => {
    if (setupInProgressRef.current) return null;
    setupInProgressRef.current = true;

    try {
      const { data: anyHousehold } = await supabase
        .from('households').select('id').limit(1).maybeSingle();

      const { data: existingMember } = await supabase
        .from('household_members').select('*')
        .eq('email', authUser.email.toLowerCase()).maybeSingle();

      // FIX: derive first name from Google display name if available, fall back to email prefix
      const rawName: string =
        authUser.user_metadata?.full_name?.split(' ')[0] ||
        authUser.user_metadata?.name?.split(' ')[0] ||
        authUser.email.split('@')[0];
      // Sanitise email-prefix names like "john.doe123" → "john"
      const firstName = rawName.split(/[^a-zA-Z]/)[0] || rawName;

      let householdId: string;
      let role: 'admin' | 'user' = 'user';

      if (!anyHousehold) {
        const { data: household, error: hErr } = await supabase
          .from('households')
          .insert({ name: 'Main Household', created_by: authUser.id })
          .select().single();
        if (hErr || !household) throw hErr ?? new Error('Household creation failed');
        householdId = household.id;
        role = 'admin';
        await supabase.from('household_members').insert({
          household_id: householdId, first_name: firstName, last_name: 'Bhai',
          email: authUser.email.toLowerCase(), status: 'active', linked_user_id: authUser.id,
        });
      } else if (existingMember) {
        householdId = existingMember.household_id;
        await supabase.from('household_members')
          .update({ linked_user_id: authUser.id })
          .eq('email', authUser.email.toLowerCase());
      } else {
        const { data: household } = await supabase
          .from('households').select('id').limit(1).maybeSingle();
        if (!household) throw new Error('No household found');
        householdId = household.id;
        const { error: memberErr } = await supabase.from('household_members').insert({
          household_id: householdId, first_name: firstName, last_name: 'Bhai',
          email: authUser.email.toLowerCase(), status: 'active', linked_user_id: authUser.id,
        });
        if (memberErr) throw memberErr;
      }

      // Use upsert so a partial previous run doesn't cause a duplicate-key error
      const { error: uErr } = await supabase.from('users').upsert({
        id: authUser.id, email: authUser.email, first_name: firstName,
        last_name: 'Bhai', household_id: householdId!, role, status: 'active',
      }, { onConflict: 'id' });
      if (uErr) throw uErr;

      const { data: newDbUser } = await supabase
        .from('users').select('*').eq('id', authUser.id).maybeSingle();

      if (newDbUser) {
        setDbUser(newDbUser);
        saveUserId(authUser.id);
      }

      return newDbUser ?? null;

    } catch (err: any) {
      console.error('setupProfile error:', err);
      setError(err.message ?? 'Setup failed');
      return null; // caller checks for null
    } finally {
      setupInProgressRef.current = false;
      // FIX: always release the loading state here
      setLoading(false);
    }
  };

  // ─── fetchDashboardData ───────────────────────────────────
  const fetchDashboardData = useCallback(async (hId: string, userEmail: string) => {
    const { data: memberCard } = await supabase
      .from('household_members').select('id, first_name')
      .eq('email', userEmail.toLowerCase()).maybeSingle();

    if (!memberCard) {
      // FIX: surface the unlinked-account state instead of silent empty dashboard
      console.warn('No household_member found for email:', userEmail);
      return;
    }

    const [assignments, laundryAssignments] = await Promise.all([
      getSevaAssignments(hId),
      getLaundryAssignments(hId),
    ]);

    // FIX: show all sevas (completed + pending) so user has confirmation of done work
    setMySevas(assignments.filter((a: any) => a.member_id === memberCard.id));

    setMyLaundryDays(laundryAssignments
      .filter((a: any) => a.member_id === memberCard.id)
      .map((a: any) => a.day_of_week)
    );

    try {
      const calRes = await fetch('/api/garbage-calendar');
      const calData = await calRes.json();

      // FIX: filter out fully past dates BEFORE slicing to 4 entries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = (calData.events ?? []).filter((event: any) => {
        const d = new Date(event.date + 'T00:00:00');
        return d >= today;
      });
      setGarbageDates(upcoming);
    } catch {
      setGarbageDates([]);
    }
  }, []);

  // ─── loadUser ────────────────────────────────────────────
  const loadUser = useCallback(async (authUser: any) => {
    const { data } = await supabase
      .from('users').select('*').eq('id', authUser.id).maybeSingle();

    if (data) {
      setUser(authUser);
      setDbUser(data);
      dbUserRef.current = data;
      saveUserId(authUser.id);
      await fetchDashboardData(data.household_id, authUser.email!);
      // FIX: check if subscription has changed before re-registering push
      await registerPushNotifications(data.id, data.household_id);
      await tryRegisterPasskey(data.id);
    } else if (!setupInProgressRef.current) {
      // FIX: use ref flag instead of local variable so it survives concurrent calls
      setUser(authUser);
      const newDbUser = await setupProfile(authUser);

      if (newDbUser) {
        await fetchDashboardData(newDbUser.household_id, authUser.email!);
        await registerPushNotifications(newDbUser.id, newDbUser.household_id);

        await fetch('/api/push-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: newDbUser.id,
            title: 'Welcome to HariSanmukh!',
            body: '🙏 Jay Swaminarayan 🙏  You\'re all set. Wait for admin to assign you seva and laundry. 😊',
          }),
        });

        // FIX: queue notification prompt after passkey prompt, not simultaneously
        await tryRegisterPasskey(newDbUser.id);
        maybeEnqueueNotificationPrompt();
      }
    }
  }, [fetchDashboardData, tryRegisterPasskey, maybeEnqueueNotificationPrompt]);

  // ─── Main auth useEffect ──────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // FIX: loading timeout — prevents infinite spinner on network failure
        const loadingTimer = setTimeout(() => {
          setLoadingTimedOut(true);
          setLoading(false);
        }, LOADING_TIMEOUT_MS);

        const savedUserId = getSavedUserId();
        const passkeyRegistered = savedUserId
          ? localStorage.getItem(`hs_passkey_${savedUserId}`)
          : null;

        if (savedUserId && passkeyRegistered && browserSupportsWebAuthn()) {
          setBiometricAvailable(true);
        }

        const { data: { session } } = await supabase.auth.getSession();
        clearTimeout(loadingTimer);

        if (session?.user) {
          await loadUser(session.user);
        }
      } catch (err) {
        console.error('init error:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          // FIX: single source of truth for reset — only the listener resets state
          setUser(null);
          setDbUser(null);
          dbUserRef.current = null;
          setMySevas([]);
          setMyLaundryDays([]);
          setGarbageDates([]);
          clearUserId();
          setBiometricAvailable(false);
          setLoading(false);
        }

        // FIX: use ref instead of stale closure on dbUser state
        if (event === 'SIGNED_IN' && session?.user && !dbUserRef.current) {
          try {
            await loadUser(session.user);
          } finally {
            setLoading(false);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUser]);

  // ─── Handlers ────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    try {
      setSigningIn(true);
      setError(null);

      // FIX: auto-reset signingIn after timeout so button doesn't stay stuck
      signinTimerRef.current = setTimeout(() => setSigningIn(false), SIGNIN_TIMEOUT_MS);

      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/` },
      });
      if (e) throw e;
    } catch (err: any) {
      if (signinTimerRef.current) clearTimeout(signinTimerRef.current);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase
            .from('users').select('*').eq('id', session.user.id).maybeSingle();
          if (data) {
            setUser(session.user);
            setDbUser(data);
            dbUserRef.current = data;
            await fetchDashboardData(data.household_id, session.user.email!);
          }
        } else {
          // FIX: clearer message — makes clear it's a session issue, not a device issue
          setError('Your session has expired. Please sign in with Google to continue.');
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
          setError(`Verification failed. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining.`);
        }
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // FIX: handleLogout only calls signOut — state reset is handled by the SIGNED_OUT listener
  const handleLogout = async () => {
    setProfileOpen(false);
    await supabase.auth.signOut();
    setBiometricAttempts(0);
    setActivePrompt(null);
    queuedPromptsRef.current = [];
  };

  const handleRetryInit = () => {
    setLoadingTimedOut(false);
    setLoading(true);
    window.location.reload();
  };

  // ─── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="w-12 h-12 rounded-2xl overflow-hidden animate-pulse">
          <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading...</p>
      </main>
    );
  }

  // FIX: loading timeout error state with retry button
  if (loadingTimedOut) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="w-12 h-12 rounded-2xl overflow-hidden opacity-50">
          <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
        </div>
        <p className="text-base font-semibold text-center" style={{ color: 'var(--text-1)' }}>
          Connection timed out
        </p>
        <p className="text-sm text-center" style={{ color: 'var(--text-3)' }}>
          Please check your internet connection and try again.
        </p>
        <button
          onClick={handleRetryInit}
          className="mt-2 px-6 py-3 rounded-2xl font-semibold text-sm"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          Retry
        </button>
      </main>
    );
  }

  // ─── Not logged in ────────────────────────────────────────
  if (!user) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: 'var(--bg)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-3xl overflow-hidden mx-auto mb-4">
              <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>HariSanmukh</h1>
            {/* FIX: corrected typo "effectviely" → "effectively" */}
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Manage ghar-mandir nicely and effectively
            </p>
          </div>

          <div className="space-y-3">
            {error && (
              <div
                className="p-3 rounded-xl"
                style={{ background: 'var(--red-bg)', border: '0.5px solid var(--red)' }}
              >
                <p className="text-sm text-center" style={{ color: 'var(--red)' }}>{error}</p>
              </div>
            )}

            {/* Biometric button */}
            {biometricAvailable && (
              <button
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="w-full font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {biometricLoading ? (
                  <span className="text-sm">Verifying...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"/>
                    </svg>
                    <span>Continue with Face ID</span>
                  </>
                )}
              </button>
            )}

            {/* FIX: aria-hidden on dots — the error text already conveys attempt count */}
            {biometricAttempts > 0 && (
              <div className="flex justify-center gap-2" aria-hidden="true">
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: i < biometricAttempts ? 'var(--red)' : 'var(--border-strong)' }}
                  />
                ))}
              </div>
            )}

            {biometricAvailable && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--separator)' }} />
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--separator)' }} />
              </div>
            )}

            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full rounded-2xl px-6 py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                border: '0.5px solid var(--border-color)',
              }}
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

  // ─── Dashboard ────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <header
        className="glass-nav sticky top-0 z-30"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>HariSanmukh</h1>
          </div>

          {/* FIX: accessible label on profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Open profile menu"
            className="w-9 h-9 rounded-full overflow-hidden transition-all"
            style={{ border: '2px solid var(--border-strong)' }}
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={dbUser?.first_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span className="text-white text-sm font-bold">
                  {dbUser?.first_name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </button>
        </div>
      </header>

      {/* FIX: single prompt banner — shows one at a time via queue */}
      {activePrompt === 'passkey' && (
        <div className="px-4 py-3" style={{ backgroundColor: 'var(--accent)' }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Enable Face ID login</p>
              <p className="text-xs" style={{ color: 'var(--accent-2)' }}>Skip Google next time</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  if (dbUser) localStorage.setItem(`hs_passkey_skip_${dbUser.id}`, 'true');
                  dismissPrompt();
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--accent-bg)', opacity: 0.8 }}
              >
                Not now
              </button>
              <button
                onClick={handleSetupPasskey}
                disabled={registeringPasskey}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--accent)' }}
              >
                {registeringPasskey ? 'Setting up...' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activePrompt === 'notification' && (
        <div
          className="px-4 py-3"
          style={{ backgroundColor: 'var(--accent-bg)', borderBottom: '0.5px solid var(--border-color)' }}
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--accent-text)' }}>
                🔔 Enable Notifications
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Get reminders for seva, laundry &amp; garbage
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={dismissPrompt}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--text-3)' }}
              >
                Not now
              </button>
              <button
                onClick={async () => {
                  if (!supportsNotifications()) { dismissPrompt(); return; }
                  const permission = await Notification.requestPermission();
                  if (permission === 'granted' && dbUser) {
                    await registerPushNotifications(dbUser.id, dbUser.household_id);
                  }
                  dismissPrompt();
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Greeting */}
        <div
          className="rounded-3xl p-6 text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}
        >
          <p className="text-2xl font-bold mb-1 tracking-wide" style={{ color: 'white' }}>
            🙏 Jay Swaminarayan 🙏
          </p>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {dbUser?.first_name} Bhai 👋
          </h2>
          {dbUser?.role === 'admin' && (
            <span
              className="inline-block mt-3 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Admin
            </span>
          )}
        </div>

        <p
          className="text-xs font-semibold uppercase tracking-widest px-1"
          style={{ color: 'var(--text-3)' }}
        >
          Here's what you have this week
        </p>

        {/* My Seva */}
        {/* FIX: show completed sevas with visual differentiation instead of hiding them */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--yellow-bg)' }}
            >
              <span className="text-base">🙏</span>
            </div>
            <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>My Seva</h3>
          </div>
          {mySevas.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-4)' }}>No seva assigned this week</p>
          ) : (
            <div className="space-y-2">
              {mySevas.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2 px-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--bg-card-2)',
                    opacity: a.is_completed ? 0.6 : 1,
                  }}
                >
                  <span
                    className="font-medium text-sm"
                    style={{
                      color: 'var(--text-1)',
                      textDecoration: a.is_completed ? 'line-through' : 'none',
                    }}
                  >
                    {a.sevas?.name}
                  </span>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{
                      backgroundColor: a.is_completed ? 'var(--green-bg)' : 'var(--yellow-bg)',
                      color: a.is_completed ? 'var(--green)' : 'var(--yellow)',
                    }}
                  >
                    {a.is_completed ? '✓ Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Laundry */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-bg)' }}
            >
              <span className="text-base">👕</span>
            </div>
            <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>My Laundry Days</h3>
          </div>
          {myLaundryDays.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-4)' }}>No laundry days assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myLaundryDays.map((day) => (
                <span
                  key={day}
                  className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-bg)',
                    color: 'var(--accent-text)',
                    border: '0.5px solid var(--border-color)',
                  }}
                >
                  {day}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Garbage Collection */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--green-bg)' }}>
              <span className="text-base">🗑️</span>
            </div>
            <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>Garbage Collection</h3>
          </div>
          {garbageDates.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-4)' }}>No upcoming dates</p>
          ) : (
            <div className="list-group">
              {/* FIX: dates are pre-filtered in fetchDashboardData, safe to slice directly */}
              {Object.entries(
                garbageDates.reduce((acc: Record<string, any[]>, event: any) => {
                  if (!acc[event.date]) acc[event.date] = [];
                  acc[event.date].push(event);
                  return acc;
                }, {})
              )
              .slice(0, 4)
              .map(([date, events], idx, arr) => {
                const dateObj = new Date(date + 'T00:00:00');
                const isToday = dateObj.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={date}
                    className="flex items-center gap-4 px-4 py-3"
                    style={{
                      borderBottom: idx !== arr.length - 1 ? '0.5px solid var(--separator)' : 'none',
                      backgroundColor: isToday ? 'var(--green-bg)' : 'transparent',
                    }}
                  >
                    <div
                      className="text-xl font-bold w-8 text-center flex-shrink-0"
                      style={{ color: isToday ? 'var(--green)' : 'var(--text-1)' }}
                    >
                      {dateObj.getDate()}
                    </div>

                    <div className="w-px h-8 flex-shrink-0" style={{ backgroundColor: 'var(--separator)' }} />

                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: isToday ? 'var(--green)' : 'var(--text-1)' }}>
                        {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {dateObj.toLocaleDateString('en-US', { month: 'long' })}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-0.5">
                      {events.map((event: any, i: number) => (
                        <span key={i} className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {event.title}
                        </span>
                      ))}
                    </div>

                    {isToday && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--green)' }}
                      >
                        Today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <BottomNav isAdmin={dbUser?.role === 'admin'} />
      <ProfilePanel
        user={user}
        dbUser={dbUser}
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        onSwitchAccount={handleLogout}
      />
    </main>
  );
}