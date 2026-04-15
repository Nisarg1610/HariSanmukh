'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { getSevaAssignments, markSevaComplete } from '@/utils/seva';
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
import { SplashScreen } from '@/components/SplashScreen';
import { LaundryTracker } from '@/components/LaundryTracker';
import { getTodayLaundrySessions } from '@/utils/laundry';
import { SwipeToComplete } from '@/components/SwipeToComplete';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 3;
const LOADING_TIMEOUT_MS = 10_000;
const SIGNIN_TIMEOUT_MS = 5_000;

// ─── Types ────────────────────────────────────────────────────────────────────
type PromptKind = 'passkey' | 'notification' | null;

// ─── Platform-aware biometric label ──────────────────────────────────────────
function getBiometricLabel(): string {
  if (typeof navigator === 'undefined') return 'Sign in with passkey';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Sign in with fingerprint';
  if (/win/i.test(ua)) return 'Sign in with Windows Hello';
  if (/mac|iphone|ipad/i.test(ua)) return 'Continue with Face ID';
  return 'Sign in with passkey';
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  // NEW: display name always comes from household_members, not users table.
  // Admin can edit it there and this always reflects the latest value.
  const [displayName, setDisplayName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mySevas, setMySevas] = useState<any[]>([]);
  const [myLaundryDays, setMyLaundryDays] = useState<string[]>([]);
  const [allLaundryDays, setAllLaundryDays] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [garbageDates, setGarbageDates] = useState<any[]>([]);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const [activePrompt, setActivePrompt] = useState<PromptKind>(null);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [needsHouseCode, setNeedsHouseCode] = useState(false);
  const [houseCodeInput, setHouseCodeInput] = useState('');
  const [houseCodeError, setHouseCodeError] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [houseName, setHouseName] = useState<string>('Hariprabodham');
  const [dailyContent, setDailyContent] = useState<{
    siksha: any;
    swamini: any;
  } | null>(null);
  // ── Refs ──────────────────────────────────────────────────────────────────────
  const dbUserRef = useRef<any>(null);
  const setupInProgressRef = useRef(false);
  const passkeyRegistrationRef = useRef(false);
  const signinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passkeyPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortedRef = useRef(false);
  const navigatingRef = useRef(false);
  const queuedPromptsRef = useRef<PromptKind[]>([]);
  const loadUserRef = useRef<((authUser: any) => Promise<void>) | null>(null);

  useEffect(() => { dbUserRef.current = dbUser; }, [dbUser]);



  // ─── Prompt queue ─────────────────────────────────────────────────────────────
  const enqueuePrompt = useCallback((kind: PromptKind) => {
    if (!kind) return;
    queuedPromptsRef.current.push(kind);
    setActivePrompt(prev => {
      if (prev === null) return queuedPromptsRef.current.shift() ?? null;
      return prev;
    });
  }, []);

  const dismissPrompt = useCallback(() => {
    setActivePrompt(null);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      const next = queuedPromptsRef.current.shift() ?? null;
      setActivePrompt(next);
    }, 400);
  }, []);

  // ─── Notification helpers ─────────────────────────────────────────────────────
  const supportsNotifications = useCallback((): boolean =>
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
    , []);

  const maybeEnqueueNotificationPrompt = useCallback(() => {
    if (!supportsNotifications()) return;
    if (Notification.permission !== 'granted') enqueuePrompt('notification');
  }, [supportsNotifications, enqueuePrompt]);

  // ─── setupProfile ─────────────────────────────────────────────────────────────
  const setupProfile = useCallback(async (authUser: any, targetHouseName?: string): Promise<any | null> => {
    if (setupInProgressRef.current) return null;
    setupInProgressRef.current = true;

    try {
      setError(null);

      // Derive first name from Google profile, fall back to sanitised email prefix
      const rawName: string =
        authUser.user_metadata?.full_name?.split(' ')[0] ||
        authUser.user_metadata?.name?.split(' ')[0] ||
        authUser.email.split('@')[0];
      const firstName = rawName.split(/[^a-zA-Z]/)[0] || rawName;

      let householdId = '';
      let role: 'admin' | 'user' = 'user';

      if (targetHouseName) {
        // Find existing household by name
        const { data: existingHousehold } = await supabase
          .from('households')
          .select('id')
          .eq('name', targetHouseName)
          .maybeSingle();

        if (existingHousehold) {
          householdId = existingHousehold.id;
        } else {
          // Create the house if it doesn't exist
          const { data: household, error: hErr } = await supabase
            .from('households')
            .insert({ name: targetHouseName, created_by: authUser.id })
            .select().single();
          if (hErr || !household) throw hErr ?? new Error('Household creation failed');
          householdId = household.id;
          role = 'admin'; // First person to create it becomes admin by default
        }

        // Now find or create member in this household
        const { data: existingMember } = await supabase
          .from('household_members').select('*')
          .eq('email', authUser.email.toLowerCase())
          .eq('household_id', householdId)
          .maybeSingle();

        if (existingMember) {
          await supabase.from('household_members')
            .update({ linked_user_id: authUser.id })
            .eq('id', existingMember.id);
        } else {
          await supabase.from('household_members').insert({
            household_id: householdId, first_name: firstName, last_name: 'Bhai',
            email: authUser.email.toLowerCase(), status: 'active', linked_user_id: authUser.id,
          });
        }
      } else {
        // Fallback for pre-invited people without a targetHouseName
        const { data: existingMember } = await supabase
          .from('household_members').select('*')
          .eq('email', authUser.email.toLowerCase()).maybeSingle();

        if (existingMember) {
          householdId = existingMember.household_id;
          await supabase.from('household_members')
            .update({ linked_user_id: authUser.id })
            .eq('id', existingMember.id);
        } else {
          throw new Error('HOUSE_CODE_REQUIRED');
        }
      }

      if (!householdId) throw new Error('householdId was never assigned');

      const { error: uErr } = await supabase.from('users').upsert({
        id: authUser.id, email: authUser.email, first_name: firstName,
        last_name: 'Bhai', household_id: householdId, role, status: 'active',
        welcome_sent: false,
      }, { onConflict: 'id' });
      if (uErr) throw uErr;

      const { data: newDbUser } = await supabase
        .from('users').select('*').eq('id', authUser.id).maybeSingle();

      if (newDbUser) {
        setDbUser(newDbUser);
        dbUserRef.current = newDbUser;
        saveUserId(authUser.id);
      }

      return newDbUser ?? null;

    } catch (err: any) {
      console.error('setupProfile error:', err);
      setError(err.message ?? 'Setup failed');
      return null;
    } finally {
      setupInProgressRef.current = false;
    }
  }, []);

  const fetchDashboardData = useCallback(async (hId: string, userEmail: string) => {
    let nextDisplayName = userEmail.split('@')[0];
    let nextSevas: any[] = [];
    let nextLaundryDays: any[] = [];
    let nextGarbage: any[] = [];
    let nextContent: any = null;

    const { data: memberCard } = await supabase
      .from('household_members')
      .select('id, first_name, last_name')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();

    if (!memberCard) {
      console.warn('fetchDashboardData: no household_member for', userEmail);
    } else {
      nextDisplayName = memberCard.first_name?.trim() || nextDisplayName;
      setDisplayName(nextDisplayName);

      try {
        const [assignments, laundryAssignments, sessions] = await Promise.all([
          getSevaAssignments(hId),
          getLaundryAssignments(hId),
          getTodayLaundrySessions(hId),
        ]);
        nextSevas = assignments.filter((a: any) => a.member_id === memberCard.id);
        nextLaundryDays = laundryAssignments
          .filter((a: any) => a.member_id === memberCard.id)
          .map((a: any) => a.day_of_week);
        setMySevas(nextSevas);
        setMyLaundryDays(nextLaundryDays);
        setMemberId(memberCard.id);
        setAllLaundryDays(laundryAssignments);
        setTodaySessions(sessions);
      } catch (err) {
        console.error('fetchDashboardData: seva/laundry failed', err);
      }
    }

    try {
      const { data: household } = await supabase
        .from('households')
        .select('name')
        .eq('id', hId)
        .maybeSingle();
      if (household?.name) {
        setHouseName(household.name);
        try { localStorage.setItem('hs_my_house_name', household.name); } catch (e) { }
      }
    } catch (e) { }

    try {
      const contentRes = await fetch('/api/daily-content');
      nextContent = await contentRes.json();
      setDailyContent(nextContent);
    } catch {
      console.error('Failed to fetch daily content');
    }

    try {
      const calRes = await fetch(`/api/garbage-calendar?householdId=${hId}`);
      if (!calRes.ok) throw new Error(`Calendar API ${calRes.status}`);
      const calData = await calRes.json();

      const now = new Date();
      const pastLimit = new Date();
      pastLimit.setDate(now.getDate() - 30);
      const futureLimit = new Date();
      futureLimit.setDate(now.getDate() + 60);

      nextGarbage = (calData.events ?? []).filter((event: any) => {
        const d = new Date(event.date + 'T00:00:00');
        return d >= pastLimit && d <= futureLimit;
      });
      setGarbageDates(nextGarbage);
    } catch (err) {
      console.error('fetchDashboardData: garbage calendar failed', err);
      setGarbageDates([]);
    }

    // Cache to localStorage for offline access
    try {
      localStorage.setItem(`hs_dash_${userEmail.toLowerCase()}`, JSON.stringify({
        displayName: nextDisplayName,
        mySevas: nextSevas,
        myLaundryDays: nextLaundryDays,
        garbageDates: nextGarbage,
        dailyContent: nextContent
      }));
    } catch (e) { }
  }, []);

  // ─── tryRegisterPasskey ───────────────────────────────────────────────────────
  const tryRegisterPasskey = useCallback(async (userId: string) => {
    if (!browserSupportsWebAuthn()) return;
    if (passkeyRegistrationRef.current) return;
    if (abortedRef.current) return;

    const { data: existingPasskey } = await supabase
      .from('passkeys').select('id').eq('user_id', userId).maybeSingle();

    if (existingPasskey) {
      localStorage.setItem(`hs_passkey_${userId}`, 'true');
      return;
    }

    const skipped = localStorage.getItem(`hs_passkey_skip_${userId}`);
    if (skipped) return;

    if (passkeyPromptTimerRef.current) clearTimeout(passkeyPromptTimerRef.current);
    passkeyPromptTimerRef.current = setTimeout(() => {
      if (!abortedRef.current) enqueuePrompt('passkey');
    }, 2500);
  }, [enqueuePrompt]);

  // ─── handleSetupPasskey ───────────────────────────────────────────────────────
  const handleSetupPasskey = async () => {
    if (!dbUser || !user) return;
    if (passkeyRegistrationRef.current) return;

    try {
      passkeyRegistrationRef.current = true;
      setRegisteringPasskey(true);
      const registered = await registerPasskey(dbUser.id, user.email!);

      if (registered) {
        setBiometricAvailable(true);
        saveUserId(dbUser.id);
        localStorage.setItem(`hs_passkey_${dbUser.id}`, 'true');
        dismissPrompt();
      } else {
        setError('Could not set up Face ID. Please try again.');
        dismissPrompt();
      }
    } catch (err: any) {
      setError(err.message ?? 'Face ID setup failed. Please try again.');
      dismissPrompt();
    } finally {
      setRegisteringPasskey(false);
      passkeyRegistrationRef.current = false;
    }
  };

  // ─── sendWelcomeNotification ──────────────────────────────────────────────────
  // Correct sequence: requestPermission â†’ subscribe â†’ wait for session cookie â†’ POST â†’ mark sent
  const sendWelcomeNotification = useCallback(async (newDbUser: any) => {
    try {
      if (!supportsNotifications()) return;

      const permission = Notification.permission;
      if (permission !== 'granted') {
        console.info('sendWelcomeNotification: permission not granted yet');
        return;
      }

      await registerPushNotifications(newDbUser.id, newDbUser.household_id);

      // Wait for Supabase session cookie to propagate after OAuth redirect
      await new Promise(resolve => setTimeout(resolve, 1000));

      const res = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newDbUser.id,
          title: 'Welcome to Hariprabodham!',
          body: 'ðŸ™ Jay Swaminarayan ðŸ™  You\'re all set. Wait for admin to assign seva and laundry. ðŸ˜Š',
        }),
      });

      if (!res.ok) {
        console.error('sendWelcomeNotification: API returned', res.status);
        return;
      }

      await supabase
        .from('users')
        .update({ welcome_sent: true })
        .eq('id', newDbUser.id);

    } catch (err) {
      console.error('sendWelcomeNotification failed:', err);
    }
  }, [supportsNotifications]);

  // ─── loadUser ────────────────────────────────────────────────────────────────
  const loadUser = useCallback(async (authUser: any) => {
    if (abortedRef.current) return;
    setError(null);

    const { data } = await supabase
      .from('users').select('*').eq('id', authUser.id).maybeSingle();

    if (abortedRef.current) return;

    if (data && data.household_id) {
      setUser(authUser);
      setDbUser(data);
      dbUserRef.current = data;
      saveUserId(authUser.id);
      // fetchDashboardData also sets displayName from household_members
      await fetchDashboardData(data.household_id, authUser.email!);
      await registerPushNotifications(data.id, data.household_id);
      await tryRegisterPasskey(data.id);
      maybeEnqueueNotificationPrompt();
    } else if (!setupInProgressRef.current) {
      setUser(authUser);

      // Check if user is already a pre-invited member somewhere
      const { data: existingMember } = await supabase
        .from('household_members').select('*')
        .eq('email', authUser.email.toLowerCase()).maybeSingle();

      if (existingMember) {
        const newDbUser = await setupProfile(authUser);
        if (abortedRef.current) return;
        if (newDbUser) {
          await fetchDashboardData(newDbUser.household_id, authUser.email!);
          if (!newDbUser.welcome_sent) await sendWelcomeNotification(newDbUser);
          await tryRegisterPasskey(newDbUser.id);
          maybeEnqueueNotificationPrompt();
        }
      } else {
        // User needs a house code
        setNeedsHouseCode(true);
      }
    }
  }, [
    fetchDashboardData, tryRegisterPasskey, setupProfile,
    sendWelcomeNotification, maybeEnqueueNotificationPrompt,
  ]);

  const handleHouseCodeSubmit = async () => {
    if (!houseCodeInput || houseCodeInput.length !== 5) {
      setHouseCodeError('Please enter a 5-digit code.');
      return;
    }
    setSubmittingCode(true);
    setHouseCodeError('');

    const HOUSE_CODES: Record<string, string> = {
      '11111': 'HariSanmukh',
      '22222': 'HariSharan',
      '33333': 'HariNaman',
      '44444': 'HariChintan',
      '55555': 'SuhradVihar',
    };

    const houseName = HOUSE_CODES[houseCodeInput];
    if (!houseName) {
      setHouseCodeError('Invalid house code. Please try again.');
      setSubmittingCode(false);
      return;
    }

    try {
      const newDbUser = await setupProfile(user, houseName);
      if (newDbUser) {
        setNeedsHouseCode(false);
        await fetchDashboardData(newDbUser.household_id, user.email!);
        if (!newDbUser.welcome_sent) {
          await sendWelcomeNotification(newDbUser);
        }
        await tryRegisterPasskey(newDbUser.id);
        maybeEnqueueNotificationPrompt();
      } else {
        setHouseCodeError('Failed to join house. Please try again.');
      }
    } catch (e: any) {
      setHouseCodeError(e.message ?? 'An error occurred.');
    } finally {
      setSubmittingCode(false);
    }
  };

  useEffect(() => { loadUserRef.current = loadUser; }, [loadUser]);

  // ─── Main auth useEffect â€” stable [] deps ────────────────────────────────────
  useEffect(() => {
    abortedRef.current = false;

    const init = async () => {
      try {
        const cachedName = localStorage.getItem('hs_my_house_name');
        if (cachedName) setHouseName(cachedName);
      } catch (e) { }

      const initStart = Date.now();
      const enforceSplash = () => {
        const elapsed = Date.now() - initStart;
        const remaining = Math.max(0, 2500 - elapsed);
        setTimeout(() => {
          if (!abortedRef.current) setLoading(false);
        }, remaining);
      };

      try {
        const loadingTimer = setTimeout(() => {
          abortedRef.current = true;
          setLoadingTimedOut(true);
          setLoading(false);
        }, LOADING_TIMEOUT_MS);

        const savedUserId = getSavedUserId();
        if (savedUserId && browserSupportsWebAuthn()) {
          // Fire and forget so we don't block the UI
          (async () => {
            try {
              const { data } = await supabase
                .from('passkeys').select('id').eq('user_id', savedUserId).maybeSingle();
              if (data) setBiometricAvailable(true);
            } catch (err) {
              console.error(err);
            }
          })();
        }

        // Fast Offline PWA path to bypass session hang
        let fastUnlock = false;
        try {
          const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          if (sbKey) {
            const lsData = JSON.parse(localStorage.getItem(sbKey) || '{}');
            if (lsData?.user) {
              setUser(lsData.user);
              fastUnlock = true;
              clearTimeout(loadingTimer);
              enforceSplash(); // Hold splash for at least 2.5s to mask the background sync jump

              const cachedDash = localStorage.getItem(`hs_dash_${lsData.user.email?.toLowerCase()}`);
              if (cachedDash) {
                const cache = JSON.parse(cachedDash);
                if (cache.displayName) setDisplayName(cache.displayName);
                if (cache.mySevas) setMySevas(cache.mySevas);
                if (cache.myLaundryDays) setMyLaundryDays(cache.myLaundryDays);
                if (cache.garbageDates) setGarbageDates(cache.garbageDates);
                if (cache.dailyContent) setDailyContent(cache.dailyContent);
              }
            }
          }
        } catch (e) { }

        const { data: { session } } = await supabase.auth.getSession();

        if (!fastUnlock) {
          clearTimeout(loadingTimer);
          if (!abortedRef.current && session?.user) {
            setUser(session.user);
            await loadUserRef.current?.(session.user);
            enforceSplash();
          } else {
            enforceSplash();
          }
        } else if (session?.user && !abortedRef.current) {
          // Background sync
          loadUserRef.current?.(session.user);
        }
      } catch (err) {
        console.error('init error:', err);
        if (!abortedRef.current) enforceSplash(); // if it fails, still unveil gracefully
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setDbUser(null);
          dbUserRef.current = null;
          setDisplayName('');          // NEW: clear display name on logout
          setMySevas([]);
          setMyLaundryDays([]);
          setGarbageDates([]);
          setBiometricAvailable(false);
          setBiometricAttempts(0);
          setActivePrompt(null);
          queuedPromptsRef.current = [];
          clearUserId();
          setLoading(false);
        }

        if (event === 'SIGNED_IN' && session?.user && !dbUserRef.current) {
          try {
            await loadUserRef.current?.(session.user);
          } finally {
            if (!abortedRef.current) setLoading(false);
          }
        }
      }
    );

    return () => {
      abortedRef.current = true;
      subscription.unsubscribe();
      if (passkeyPromptTimerRef.current) clearTimeout(passkeyPromptTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (signinTimerRef.current) clearTimeout(signinTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (navigatingRef.current) return;
    try {
      setSigningIn(true);
      setError(null);
      navigatingRef.current = true;
      signinTimerRef.current = setTimeout(() => {
        setSigningIn(false);
        navigatingRef.current = false;
      }, SIGNIN_TIMEOUT_MS);
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (e) throw e;
    } catch (err: any) {
      if (signinTimerRef.current) clearTimeout(signinTimerRef.current);
      navigatingRef.current = false;
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
            // fetchDashboardData sets displayName from household_members
            await fetchDashboardData(data.household_id, session.user.email!);
            await registerPushNotifications(data.id, data.household_id);
          }
        } else {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session?.user) {
            const { data } = await supabase
              .from('users').select('*').eq('id', refreshed.session.user.id).maybeSingle();
            if (data) {
              setUser(refreshed.session.user);
              setDbUser(data);
              dbUserRef.current = data;
              await fetchDashboardData(data.household_id, refreshed.session.user.email!);
              await registerPushNotifications(data.id, data.household_id);
              return;
            }
          }
          setError(
            'Your login session has fully expired. ' +
            'Face ID confirmed your identity, but please sign in with Google once to renew it.'
          );
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
          const remaining = MAX_ATTEMPTS - newAttempts;
          setError(`Verification failed. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        }
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleLogout = async () => {
    setProfileOpen(false);

    // 1. Sign out from Supabase â€” clears the sb-* session cookies
    await supabase.auth.signOut();

    // 2. Clear all app-specific localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('hs_passkey_') ||
        key.startsWith('hs_theme') ||
        key.startsWith('sb-')          // Supabase auth tokens stored by the JS client
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 3. Clear sessionStorage entirely
    sessionStorage.clear();

    // 4. Clear all cookies for this domain
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      // Expire on root path and any sub-paths Supabase might have set
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`;
    });

    // State reset is handled by the SIGNED_OUT listener in the auth useEffect
  };

  const handleRetryInit = () => {
    abortedRef.current = false;
    setLoadingTimedOut(false);
    setLoading(true);
    window.location.reload();
  };

  // ─── Garbage date groups ──────────────────────────────────────────────────────
  // NEW: no .slice() â€” show the FULL upcoming month worth of dates.
  // Dates are grouped by day (multiple event types on same day merge into one row).
  // garbageDates is already filtered to today-onwards in fetchDashboardData.
  const garbageDateGroups = useMemo(() => {
    const grouped = garbageDates.reduce((acc: Record<string, any[]>, event: any) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});
    const todayStr = new Date().toDateString();
    const todayTs = new Date().setHours(0, 0, 0, 0);
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => {
        const d = new Date(date + 'T00:00:00');
        const ts = d.setHours(0, 0, 0, 0);
        const status: 'past' | 'today' | 'upcoming' =
          d.toDateString() === todayStr ? 'today'
            : ts < todayTs ? 'past'
              : 'upcoming';
        return { date, events: events as any[], status };
      });
  }, [garbageDates]);

  const firstPendingSeva = useMemo(
    () => (mySevas ?? []).find((a: any) => !a.is_completed) ?? null,
    [mySevas]
  );

  const handleMarkSevaDone = useCallback(async () => {
    if (!firstPendingSeva?.id || !user) return;
    const assignmentId = firstPendingSeva.id as string;

    try {
      const ok = await markSevaComplete(assignmentId);
      if (!ok) return;

      setMySevas((prev) => {
        const next = prev.map((a: any) =>
          a.id === assignmentId
            ? { ...a, is_completed: true, completed_at: new Date().toISOString() }
            : a
        );

        // Update offline cache so refresh doesn't show it pending again
        try {
          const cacheKey = `hs_dash_${user.email?.toLowerCase()}`;
          const str = localStorage.getItem(cacheKey);
          if (str) {
            const data = JSON.parse(str);
            data.mySevas = next;
            localStorage.setItem(cacheKey, JSON.stringify(data));
          }
        } catch (e) { }

        return next;
      });
    } catch (err) {
      console.error('handleMarkSevaDone failed', err);
    }
  }, [firstPendingSeva, user]);

  // ─── Render: loading ──────────────────────────────────────────────────────────
  if (loading) {
    return <SplashScreen heading={houseName} />;
  }

  // ─── Render: timeout ──────────────────────────────────────────────────────────
  if (loadingTimedOut) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
        style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-12 h-12 rounded-2xl overflow-hidden opacity-50">
          <img src="/icon-256.png" alt={houseName} className="w-full h-full object-cover" />
        </div>
        <p className="text-base font-semibold text-center" style={{ color: 'var(--text-1)' }}>
          Connection timed out
        </p>
        <p className="text-sm text-center" style={{ color: 'var(--text-3)' }}>
          Please check your internet connection and try again.
        </p>
        <button onClick={handleRetryInit}
          className="mt-2 px-6 py-3 rounded-2xl font-semibold text-sm"
          style={{ background: 'var(--accent)', color: 'white' }}>
          Retry
        </button>
      </main>
    );
  }

  // ─── Render: login ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: 'var(--bg)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-3xl overflow-hidden mx-auto mb-4">
              <img src="/icon-256.png" alt="Hariprabodham" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
              HariPrabodham
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Manage ghar-mandir nicely and effectively
            </p>
          </div>

          <div className="space-y-3">
            {error && (
              <div className="p-3 rounded-xl"
                style={{ background: 'var(--red-bg)', border: '0.5px solid var(--red)' }}>
                <p className="text-sm text-center" style={{ color: 'var(--red)' }}>{error}</p>
              </div>
            )}

            {biometricAvailable && (
              <button onClick={handleBiometricLogin} disabled={biometricLoading}
                className="w-full font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}>
                {biometricLoading ? (
                  <span className="text-sm">Verifying...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                    </svg>
                    <span>{getBiometricLabel()}</span>
                  </>
                )}
              </button>
            )}

            {biometricAttempts > 0 && (
              <div className="flex justify-center gap-2" aria-hidden="true">
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full"
                    style={{ background: i < biometricAttempts ? 'var(--red)' : 'var(--border-strong)' }} />
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

            <button onClick={handleGoogleLogin} disabled={signingIn}
              className="w-full rounded-2xl px-6 py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                border: '0.5px solid var(--border-color)',
              }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {signingIn ? 'Redirecting...' : 'Sign in with Google'}
            </button>

            <div className="pt-6 text-center">
              <Link href="/privacy-policy" className="text-xs hover:underline" style={{ color: 'var(--text-3)' }}>
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (needsHouseCode) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: 'var(--bg)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
              Join a House
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Enter the 5-digit code for your house
            </p>
          </div>

          <div className="space-y-4">
            {houseCodeError && (
              <div className="p-3 rounded-xl"
                style={{ background: 'var(--red-bg)', border: '0.5px solid var(--red)' }}>
                <p className="text-sm text-center" style={{ color: 'var(--red)' }}>{houseCodeError}</p>
              </div>
            )}

            <input
              type="text"
              value={houseCodeInput}
              onChange={e => setHouseCodeInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              placeholder="12345"
              disabled={submittingCode}
              pattern="\d*"
              inputMode="numeric"
              className="w-full text-center text-3xl tracking-[1em] py-4 rounded-2xl outline-none transition-all focus:ring-2"
              style={{ background: 'var(--bg-card-2)', color: 'var(--text-1)', border: '1px solid var(--border-color)', letterSpacing: '0.5em' }}
            />

            <button onClick={handleHouseCodeSubmit} disabled={submittingCode || houseCodeInput.length !== 5}
              className="w-full font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}>
              {submittingCode ? 'Joining...' : 'Join House'}
            </button>
            <button onClick={() => { supabase.auth.signOut(); setNeedsHouseCode(false); setUser(null); }}
              className="w-full py-3 text-sm flex items-center justify-center transition-all"
              style={{ color: 'var(--text-3)' }}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── Render: dashboard ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)' }}>

      <header className="glass-nav sticky top-0 z-30"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/icon-256.png" alt={houseName} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>{houseName}</h1>
          </div>
          <button onClick={() => setProfileOpen(true)}
            aria-label="Open profile menu"
            className="w-9 h-9 rounded-full overflow-hidden transition-all"
            style={{ border: '2px solid var(--border-strong)' }}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt={displayName}
                className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}>
                {/* NEW: avatar initial also from displayName */}
                <span className="text-white text-sm font-bold">
                  {displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </button>
        </div>
      </header>

      {/* Prompt banners */}
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
                style={{ color: 'var(--accent-bg)', opacity: 0.8 }}>
                Not now
              </button>
              <button onClick={handleSetupPasskey} disabled={registeringPasskey}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--accent)' }}>
                {registeringPasskey ? 'Setting up...' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activePrompt === 'notification' && (
        <div className="px-4 py-3"
          style={{ backgroundColor: 'var(--accent-bg)', borderBottom: '0.5px solid var(--border-color)' }}>
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
              <button onClick={dismissPrompt}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--text-3)' }}>
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
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">

        <div
          className="rounded-3xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(140deg, var(--accent) 0%, var(--accent-2) 100%)' }}
        >
          <p className="text-[12px] uppercase tracking-widest font-semibold text-white/80 mb-1">
            Hari Dashboard
          </p>
          <h2 className="text-xl font-extrabold mb-1">🙏 Jay Swaminarayan, {displayName} Bhai</h2>
          <p className="text-sm text-white/85">Everything for today in one place.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/links"
            className="card p-4 rounded-2xl block transition-transform active:scale-[0.99]"
            style={{ minHeight: 116 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-3)' }}>
                  General Info
                </p>
                <p className="text-base font-extrabold mt-1.5" style={{ color: 'var(--text-1)' }}>
                  Aarti &amp; Pooja
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-4)' }}>
                  Quick access
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--accent-bg)' }}
                aria-hidden="true"
              >
                <span className="text-lg">🙏</span>
              </div>
            </div>
          </Link>

          <Link
            href="/swadhyay"
            className="card p-4 rounded-2xl block transition-transform active:scale-[0.99]"
            style={{ minHeight: 116 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-3)' }}>
                  Swadhyay
                </p>
                <p className="text-base font-extrabold mt-1.5 truncate" style={{ color: 'var(--text-1)' }}>
                  {dailyContent?.siksha?.shloka_number
                    ? `Sikshapatri #${dailyContent.siksha.shloka_number}`
                    : 'Swadhyay of the Day'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-4)' }}>
                  Tap to read
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--yellow-bg)' }}
                aria-hidden="true"
              >
                <span className="text-lg">📖</span>
              </div>
            </div>
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--yellow)' }} />
            <h3 className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>
              Today&apos;s Priorities
            </h3>
          </div>
          <Link href="/calendar" className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
            Full Calendar
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Link
            href="/seva"
            className="md:col-span-2 flex flex-col justify-between card p-5 rounded-[24px] transition-transform active:scale-[0.98] shadow-sm hover:shadow-md min-h-[210px] relative"
            style={{
              backgroundColor: firstPendingSeva?.id ? 'var(--green-bg)' : 'var(--bg-card)',
              border: firstPendingSeva?.id ? '2px solid rgba(45, 158, 107, 0.4)' : '1px solid var(--separator)'
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: firstPendingSeva?.id ? 'white' : 'var(--bg-card-2)' }}>
                  <span className="text-lg">🙏</span>
                </div>
                {firstPendingSeva?.id && (
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: firstPendingSeva?.id ? 'var(--green)' : 'var(--text-3)' }}>My Seva</p>
              <p className="text-[16px] font-extrabold leading-snug line-clamp-2" style={{ color: firstPendingSeva?.id ? '#1A6340' : 'var(--text-1)' }}>
                {firstPendingSeva?.sevas?.name || mySevas?.[0]?.sevas?.name || 'No active seva'}
              </p>
            </div>

            {firstPendingSeva?.id ? (
              <>
                <p className="text-[11px] font-bold mt-2 mb-1" style={{ color: '#1A6340' }}>
                  Swipe to mark seva done
                </p>
                <SwipeToComplete onSwipeComplete={() => {
                  handleMarkSevaDone();
                }} />
              </>
            ) : (
              <div
                className="w-full mt-4 py-3 rounded-[14px] text-[13px] font-bold text-center border-2 border-dashed"
                style={{ backgroundColor: 'transparent', color: 'var(--text-4)', borderColor: 'var(--separator)' }}
              >
                Caught up!
              </div>
            )}
          </Link>

          <Link
            href="/laundry"
            className="md:col-span-2 flex flex-col justify-between card p-5 rounded-[24px] transition-transform active:scale-[0.98] shadow-sm hover:shadow-md min-h-[210px]"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--separator)' }}
          >
            <div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 shadow-inner" style={{ backgroundColor: 'var(--accent-bg)' }}>
                <span className="text-lg text-[var(--accent)]">👕</span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>My Laundry</p>
              <p className="text-[20px] font-extrabold leading-tight truncate pb-1" style={{ color: 'var(--text-1)' }}>
                {myLaundryDays?.[0] || 'No schedule'}
              </p>
            </div>

            <div className="mt-auto">
              {dbUser?.household_id && memberId && (
                <LaundryTracker
                  householdId={dbUser.household_id}
                  memberId={memberId}
                  allLaundryDays={allLaundryDays}
                  initialSessions={todaySessions}
                />
              )}
              {!(new Date().getHours() >= 18 && allLaundryDays.filter(a => a.day_of_week === new Date().toLocaleDateString('en-US', { weekday: 'long' })).some(a => a.member_id === memberId)) && (
                (myLaundryDays?.length ?? 0) > 1 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {myLaundryDays.slice(1, 3).map((day) => (
                      <span key={day} className="px-2.5 py-1.5 rounded-[10px] text-[11px] font-extrabold line-clamp-1 shadow-sm leading-none"
                        style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
                        {day.substring(0, 3).toUpperCase()}
                      </span>
                    ))}
                    {myLaundryDays.length > 3 && (
                      <span className="px-2 py-1.5 rounded-[10px] text-[11px] font-bold leading-none"
                        style={{ backgroundColor: 'rgba(0,0,0,0.03)', color: 'var(--text-3)' }}>
                        +{myLaundryDays.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] font-medium mt-2" style={{ color: 'var(--text-3)' }}>Wash on your assigned day.</p>
                )
              )}
            </div>
          </Link>
          <Link
            href="/calendar"
            className="md:col-span-1 card rounded-[24px] p-4 border border-[var(--separator)] shadow-sm transition-transform active:scale-[0.99] block"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                Garbage
              </p>
              <span className="text-lg">🗑️</span>
            </div>
            {garbageDateGroups.length === 0 ? (
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-3)' }}>
                No upcoming pickup
              </p>
            ) : (
              (() => {
                const future = garbageDateGroups.find(g => g.status !== 'past') ?? garbageDateGroups[garbageDateGroups.length - 1];
                const dateObj = new Date(future.date + 'T00:00:00');
                return (
                  <div>
                    <p className="text-[26px] font-black leading-none mb-1" style={{ color: 'var(--text-1)' }}>
                      {dateObj.getDate()}
                    </p>
                    <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                      {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short' })}
                    </p>
                    <div className="space-y-1">
                      {future.events.slice(0, 2).map((event: any, i: number) => (
                        <p
                          key={i}
                          className="text-[11px] font-bold px-2 py-1 rounded-lg truncate"
                          style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)' }}
                        >
                          {event.title}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}
            <p className="text-[11px] font-bold mt-3" style={{ color: 'var(--accent)' }}>
              Open full schedule →
            </p>
          </Link>
        </div>

        <div className="card rounded-[24px] border border-[var(--separator)] p-4 mb-8" style={{ backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-3)' }}>
              Garbage Timeline
            </p>
            <Link href="/calendar" className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
              See all
            </Link>
          </div>
          {garbageDateGroups.length === 0 ? (
            <p className="text-[13px] font-medium py-2" style={{ color: 'var(--text-4)' }}>
              No upcoming collections this month.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {garbageDateGroups
                .filter(g => g.status !== 'past')
                .slice(0, 3)
                .map(({ date, events, status }) => {
                  const dateObj = new Date(date + 'T00:00:00');
                  return (
                    <div
                      key={date}
                      className="rounded-xl p-3 border"
                      style={{
                        borderColor: status === 'today' ? 'var(--green)' : 'var(--separator)',
                        backgroundColor: status === 'today' ? 'var(--green-bg)' : 'var(--bg-card-2)',
                      }}
                    >
                      <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-3)' }}>
                        {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-[15px] font-extrabold mb-1" style={{ color: 'var(--text-1)' }}>
                        {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[11px] font-semibold line-clamp-2" style={{ color: 'var(--text-2)' }}>
                        {events.map((e: any) => e.title).join(', ')}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

      </div>

      <BottomNav isAdmin={dbUser?.role === 'admin'} />
      {/* NEW: pass displayName to ProfilePanel so it also shows the correct name */}
      <ProfilePanel
        user={user}
        dbUser={dbUser}
        displayName={displayName}
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        onSwitchAccount={handleLogout}
      />
    </main>
  );
}
