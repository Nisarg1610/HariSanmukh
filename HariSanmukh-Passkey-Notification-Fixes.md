# Passkey (Face ID/Fingerprint) & Notification Flow — Bug Analysis & Fixes

## Problem 1: Passkey (Face ID / Fingerprint) Not Working

### What the current flow does

1. User signs in with Google OAuth → `loadUser()` is called
2. `loadUser()` calls `tryRegisterPasskey(data.id)` at the end
3. `tryRegisterPasskey()` checks if a passkey already exists in Supabase:
   - If exists → sets `hs_passkey_{userId}` in localStorage and returns
   - If no passkey AND user hasn't skipped → **waits 2.5 seconds**, then enqueues a `'passkey'` prompt
4. The `'passkey'` prompt shows a banner: "Enable Face ID login" with "Not now" / "Enable" buttons
5. Clicking "Enable" calls `handleSetupPasskey()` → `registerPasskey(userId, email)` → calls `/api/webauthn/register-options` then `/api/webauthn/register-verify`
6. On subsequent visits, `handleBiometricLogin()` calls `authenticateWithPasskey(userId)` → calls `/api/webauthn/auth-options` then `/api/webauthn/auth-verify`

### Bugs identified

#### Bug 1: WebAuthn Challenge Bypass (server-side)
**Files:** `src/app/api/webauthn/register-verify/route.ts:12`, `src/app/api/webauthn/auth-verify/route.ts:12`

The challenge is sent from the client and blindly trusted:
```ts
const { userId, response, challenge } = await request.json();
expectedChallenge: challenge, // ← CLIENT CONTROLS THIS
```

This defeats the purpose of WebAuthn but also can cause verification failures. The `@simplewebauthn/server` library may reject mismatched or replayed challenges in certain edge cases. The proper fix:

**Fix — store challenge server-side:**

`src/app/api/webauthn/register-options/route.ts` — store the challenge:
```ts
export async function POST(request: Request) {
  const { userId, email } = await request.json();

  const { data: existingPasskeys } = await supabase
    .from('passkeys')
    .select('credential_id')
    .eq('user_id', userId);

  const options = await generateRegistrationOptions({
    rpName: 'HariPrabodham',
    rpID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
    userID: new TextEncoder().encode(userId),
    userName: email,
    attestationType: 'none',
    excludeCredentials: existingPasskeys?.map((p) => ({
      id: p.credential_id,
      type: 'public-key' as const,
    })) ?? [],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  // ✅ Store challenge server-side
  await supabase.from('webauthn_challenges').upsert({
    user_id: userId,
    challenge: options.challenge,
    type: 'registration',
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type' });

  return NextResponse.json(options);
}
```

`src/app/api/webauthn/register-verify/route.ts` — retrieve from server:
```ts
export async function POST(request: Request) {
  const { userId, response } = await request.json();
  // ← No longer accepting 'challenge' from client

  // ✅ Retrieve challenge from server
  const { data: challengeRow } = await supabase
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', userId)
    .eq('type', 'registration')
    .maybeSingle();

  if (!challengeRow) {
    return NextResponse.json({ verified: false, error: 'No pending challenge' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge, // ✅ Server-side challenge
      expectedOrigin: origin,
      expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
    });

    // ... rest stays the same

    // ✅ Clean up used challenge
    await supabase.from('webauthn_challenges')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'registration');
  }
}
```

Do the same for `auth-options/route.ts` and `auth-verify/route.ts`.

**SQL for the new table:**
```sql
CREATE TABLE public.webauthn_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, type)
);
```

And update the client (`src/utils/webauthn.ts`) to stop sending the challenge:
```ts
// registerPasskey — remove challenge from the verify request body
const verifyRes = await fetch('/api/webauthn/register-verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    response: registration,
    // ← challenge REMOVED
  }),
});
```

Same for `authenticateWithPasskey`.

---

#### Bug 2: Biometric login fails when Supabase session expires
**File:** `src/app/page.tsx:667-726` (`handleBiometricLogin`)

When a user returns to the app and the Supabase OAuth session has expired (cookies cleared, token expired), the passkey authentication itself succeeds (WebAuthn is local), but then:
```ts
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) { ... } // ← NULL because OAuth expired
```

The fallback `refreshSession()` also fails because the refresh token is gone. Result: "Your login session has fully expired. Please sign in with Google once to renew it."

**This is actually working as designed** — WebAuthn only proves identity locally, it doesn't create a Supabase session. But the error message is confusing.

**Suggested improvement:** After successful WebAuthn, auto-trigger Google re-auth silently:
```ts
if (verified) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    // Session expired — attempt silent re-auth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
        queryParams: { prompt: 'none' }, // ← silent, no picker
      },
    });
    if (error) {
      setError('Session expired. Please sign in with Google to continue.');
      setBiometricAvailable(false);
    }
    return;
  }
  // ... continue with session
}
```

---

#### Bug 3: `tryRegisterPasskey` prompt timing race
**File:** `src/app/page.tsx:329-349`

The passkey prompt is delayed by 2.5 seconds via `setTimeout`. But `loadUser` is async and already takes time. If the user navigates away or the component re-renders, the timeout may fire after cleanup, or worse — the prompt queue may already have items.

Also, `tryRegisterPasskey` is called AFTER `fetchDashboardData` and `registerPushNotifications`, which are slow network calls. By the time the 2.5s timeout fires, the user may already be interacting with the dashboard.

**Fix:** Show the passkey registration prompt immediately (no 2.5s delay) as a modal/dialog instead of a banner, right after the first sign-in completes:

```ts
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

  // ✅ Show immediately — no setTimeout delay
  enqueuePrompt('passkey');
}, [enqueuePrompt]);
```

---

#### Bug 4: `NEXT_PUBLIC_APP_DOMAIN` may be wrong
**Files:** All WebAuthn API routes

`rpID` is set to `process.env.NEXT_PUBLIC_APP_DOMAIN!`. If this doesn't match the actual domain the browser sees (e.g., it's set to `brampton-youths.vercel.app` but user is on a custom domain, or it includes `https://` or a trailing `/`), WebAuthn will silently fail.

**Fix:** Verify the env var is set to the bare domain (e.g., `brampton-youths.vercel.app`) with no protocol or trailing slash. Log it during registration to debug.

---

## Problem 2: Notification Permission Not Shown on First Sign-up

### What the current flow does

1. `loadUser()` calls `maybeEnqueueNotificationPrompt()` at the very end (line 440 or 456)
2. `maybeEnqueueNotificationPrompt` checks:
   ```ts
   if (Notification.permission !== 'granted') enqueuePrompt('notification');
   ```
3. BUT — the prompt queue system means notifications get queued BEHIND the passkey prompt
4. The passkey prompt shows first. User clicks "Not now" or "Enable". THEN the notification prompt shows.
5. If the user is returning (already has passkey + already granted notifications), neither prompt shows → correct behavior

### Why notification permission doesn't show on first signup

**Issue 1: Queue order — passkey blocks notification**

Both `tryRegisterPasskey` and `maybeEnqueueNotificationPrompt` enqueue prompts. The passkey prompt is enqueued first. When the user dismisses the passkey prompt, there's a 400ms delay before the next prompt shows:
```ts
const dismissPrompt = useCallback(() => {
  setActivePrompt(null);
  dismissTimerRef.current = setTimeout(() => {
    const next = queuedPromptsRef.current.shift() ?? null;
    setActivePrompt(next);
  }, 400);
}, []);
```

If the user doesn't interact with the passkey banner (e.g., scrolls past it), the notification prompt never shows.

**Issue 2: `registerPushNotifications` is called BEFORE asking permission**

In `loadUser()` (line 438):
```ts
await registerPushNotifications(data.id, data.household_id);
await tryRegisterPasskey(data.id);
maybeEnqueueNotificationPrompt();
```

`registerPushNotifications` runs first, but it silently exits if permission isn't granted:
```ts
const permission = Notification.permission;
if (permission !== 'granted') return false;
```

So it does nothing. Then `maybeEnqueueNotificationPrompt` queues the prompt, but it's stuck behind passkey.

### Fix: Show notification permission IMMEDIATELY on first sign-up

**Option A (Recommended): Show notification prompt as a separate full-screen dialog on first sign-up, not as a queued banner**

Replace the banner approach with a dedicated first-time-user flow:

```tsx
// In page.tsx, add state:
const [showNotifDialog, setShowNotifDialog] = useState(false);

// After setupProfile completes for a NEW user (in loadUser or handleHouseCodeSubmit):
if (!newDbUser.welcome_sent) {
  // This is a brand new user — show notification dialog immediately
  setShowNotifDialog(true);
}

// Render a modal dialog:
{showNotifDialog && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full text-center space-y-4">
      <div className="text-4xl">🔔</div>
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
        Stay Updated
      </h2>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        Get notified about your seva assignments, laundry reminders, and garbage pickup days.
      </p>
      <button
        onClick={async () => {
          const permission = await Notification.requestPermission();
          if (permission === 'granted' && dbUser) {
            await registerPushNotifications(dbUser.id, dbUser.household_id);
          }
          setShowNotifDialog(false);
          // Then show passkey prompt
          tryRegisterPasskey(dbUser.id);
        }}
        className="w-full py-3 rounded-2xl font-semibold"
        style={{ background: 'var(--accent)', color: 'white' }}
      >
        Enable Notifications
      </button>
      <button
        onClick={() => {
          setShowNotifDialog(false);
          tryRegisterPasskey(dbUser.id);
        }}
        className="w-full py-2 text-sm"
        style={{ color: 'var(--text-3)' }}
      >
        Maybe Later
      </button>
    </div>
  </div>
)}
```

**Option B (Quick fix): Reverse the prompt order and remove the delay**

In `loadUser()`, call notification FIRST, passkey SECOND:
```ts
maybeEnqueueNotificationPrompt(); // ← FIRST
await tryRegisterPasskey(data.id); // ← SECOND
```

And remove the 2.5s `setTimeout` in `tryRegisterPasskey` so it queues immediately.

**Option C: Show both prompts together (not recommended)**

This would overwhelm the user.

---

## Summary of Required Changes

| # | Change | File(s) | Priority |
|---|--------|---------|----------|
| 1 | Store WebAuthn challenges server-side (create `webauthn_challenges` table) | API routes + SQL | Critical |
| 2 | Stop sending challenge from client | `src/utils/webauthn.ts` | Critical |
| 3 | Verify `NEXT_PUBLIC_APP_DOMAIN` env var is bare domain | `.env` | Critical |
| 4 | Show notification dialog immediately on first signup (before passkey) | `src/app/page.tsx` | High |
| 5 | Remove 2.5s delay on passkey prompt | `src/app/page.tsx` | Medium |
| 6 | Handle expired Supabase session gracefully after WebAuthn | `src/app/page.tsx` | Medium |
