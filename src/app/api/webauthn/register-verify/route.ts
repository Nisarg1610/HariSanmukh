import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getAuthUser, unauthorized } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getWebAuthnFromRequest } from '@/lib/webauthn-config';

const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { userId, response } = await request.json();
  if (!userId || authUser.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { origin, rpID } = getWebAuthnFromRequest(request);
  if (!origin || !rpID) {
    return NextResponse.json({ verified: false, error: 'WebAuthn origin/rpID not configured' });
  }

  const supabase = getSupabaseAdmin();

  const { data: challengeRow } = await supabase
    .from('webauthn_challenges')
    .select('challenge, created_at')
    .eq('user_id', userId)
    .eq('type', 'registration')
    .maybeSingle();

  if (!challengeRow) {
    return NextResponse.json({ verified: false, error: 'No pending challenge' });
  }

  const age = Date.now() - new Date(challengeRow.created_at).getTime();
  if (age > CHALLENGE_MAX_AGE_MS) {
    await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'registration');
    return NextResponse.json({ verified: false, error: 'Challenge expired' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      const { error: insertError } = await supabase.from('passkeys').insert({
        user_id: userId,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        device_type: verification.registrationInfo.credentialDeviceType,
      });

      if (insertError) {
        console.error('passkeys insert:', insertError);
        return NextResponse.json({ verified: false, error: insertError.message });
      }

      await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'registration');

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false, error: 'Verification failed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    console.error('register-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
