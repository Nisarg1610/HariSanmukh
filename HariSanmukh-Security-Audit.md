# HariSanmukh (HariPrabodham) — Security Audit Report

## Overview
This is a Next.js PWA for managing ghar-mandir household tasks (seva, laundry, garbage, grocery, sabha rides). It uses **Supabase** as the backend, **Google OAuth + WebAuthn passkeys** for auth, and various APIs (Groq AI, WhatsApp, Google Calendar, Web Push).

---

### 3. API Key Leak via `/api/test-env`
**File:** `src/app/api/test-env/route.ts`
```ts
export async function GET() {
  return NextResponse.json({
    key: process.env.NEXT_PUBLIC_GROQ_API_KEY ? 'EXISTS' : 'MISSING',
    first10: process.env.NEXT_PUBLIC_GROQ_API_KEY?.substring(0, 10),
  });
}
```
**Risk:** This debug endpoint leaks the first 10 characters of an API key. This is publicly accessible with no authentication. Even partial key leakage helps attackers—especially with short keys.

**Fix:** **Delete this file entirely.** It's a debug route that should never exist in production.

---

### 4. WebAuthn Challenge Passed from Client (Challenge Bypass)
**Files:** `src/app/api/webauthn/register-verify/route.ts`, `src/app/api/webauthn/auth-verify/route.ts`

The challenge used for WebAuthn verification is **sent by the client** in the request body:
```ts
const { userId, response, challenge } = await request.json();
// ...
expectedChallenge: challenge,  // ← TRUSTING CLIENT-SUPPLIED VALUE
```
**Risk:** The challenge is meant to be a server-side secret. By sending it from the client, an attacker can replay or fabricate challenges, completely bypassing WebAuthn security. The attacker controls both the "challenge" and the "response."

**Fix:** Store the challenge server-side (in a database or short-lived cache like Redis/Supabase row) when generating options, then retrieve it during verification. Never accept the challenge from the client.

---

## 🟠 HIGH — Significant Security Issues

### 5. No Authentication on Most API Routes
The following API routes have **zero authentication**:
- `POST /api/push-notify` — Send push notifications to ANY user or ALL users (`householdId: 'all'`)
- `POST /api/push-subscribe` — Register push subscriptions for any userId
- `POST /api/laundry-whatsapp` — Send WhatsApp messages to any phone number
- `POST /api/grocery-ai` — Use Groq AI (costs money per call)
- `POST /api/grocery-categorize` — Use Groq AI
- `POST /api/schedule-push` — Schedule delayed push notifications
- `GET /api/daily-content` — No auth needed (low impact)
- `GET /api/garbage-calendar` — No auth needed (low impact)

**Risk:** Anyone can call `/api/push-notify` with `{"householdId": "all", "title": "HACKED", "body": "..."}` to spam everyone. The WhatsApp and AI endpoints can be abused for spam/cost attacks.

**Fix:** Add authentication checks (verify Supabase session) to all API routes that modify data or cost money.

---

### 7. Server-Side Code Uses Anon Key Instead of Service Role Key
**All API routes** create Supabase clients with `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // ← should be SERVICE_ROLE_KEY
);
```
**Risk:** The anon key on the server-side means your API routes are subject to Supabase Row Level Security (RLS). If RLS is misconfigured (and most of your tables have RLS **disabled**), the anon key can read/write everything anyway—which is the worst of both worlds: no RLS protection AND the key is public.

**Fix:** Use `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`) in API routes, and enable proper RLS policies on all tables.

---


## 🟡 MEDIUM — Should Fix

### 9. No Authorization Checks (Any User Can Do Admin Actions)
**File:** `src/utils/members.ts`, `src/utils/seva.ts`, etc.

All Supabase operations are done with the client directly — there are no backend checks that the current user has `role: 'admin'` before:
- Adding/removing household members
- Creating/deleting sevas
- Refreshing seva assignments
- Toggling roles (making yourself admin)

The role check at `src/app/members/page.tsx:46` (line `handleToggleRole`) is client-side only — an attacker can call `supabase.from('users').update({ role: 'admin' })` directly from the browser console.

**Fix:** Enforce authorization in Supabase RLS policies or server-side API routes.

---

### 11. Push Notification Abuse — Send to All Users
**File:** `src/app/api/push-notify/route.ts`
```ts
if (householdId !== 'all') {
  query = query.eq('household_id', householdId);
}
// else fetch all (householdId === 'all')
```
**Risk:** Passing `householdId: 'all'` sends notifications to EVERY user across all households. Combined with no auth on this endpoint, anyone can spam all users.

**Fix:** Remove the `'all'` broadcast capability or restrict it to admin-only with server-side auth.

---

### 13. `schedule-push` Uses `setTimeout` (Unreliable + Abuse Vector)
**File:** `src/app/api/schedule-push/route.ts`

Uses `setTimeout` in a serverless function to schedule delayed push notifications. As noted in the code comments, this won't work on Vercel. Additionally, the `delayMins` parameter is untrusted user input with no bounds checking.

**Risk:** An attacker could set `delayMins` to a very large number, or schedule thousands of delayed notifications.

**Fix:** Use Vercel cron jobs or a proper task queue. Validate and cap `delayMins`.

---


### 15. `fix.js`, `fix2.js`, `fix3.js` Committed to Repo
These are utility scripts that modify source files using regex. They shouldn't be in the production repo.

**Fix:** Delete these files and add them to `.gitignore`.

---

### 16. 2-Minute Session Timeout (Usability/Security Tradeoff)
**File:** `src/utils/webauthn.ts`
```ts
const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
```
This is stored client-side in localStorage and is easily modifiable. A 2-minute timeout is also very aggressive for a household management app.

---

### 17. `NEXT_PUBLIC_GROQ_API_KEY` vs `GROQ_API_KEY` Confusion
The `test-env` route checks `NEXT_PUBLIC_GROQ_API_KEY` but the actual AI routes use `GROQ_API_KEY`. The `NEXT_PUBLIC_` prefix means it's exposed to the client. If the actual Groq key is stored as `NEXT_PUBLIC_GROQ_API_KEY`, it's leaked to every browser.

**Fix:** Ensure `GROQ_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix).

---
