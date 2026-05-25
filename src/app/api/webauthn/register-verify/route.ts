import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getAuthUser, unauthorized } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getExpectedOrigin, getRpId } from '@/lib/webauthn-config';

const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { userId, response } = await request.json();
  if (!userId || authUser.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      expectedOrigin: getExpectedOrigin(),
      expectedRPID: getRpId(),
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      await supabase.from('passkeys').insert({
        user_id: userId,
        credential_id: Buffer.from(credential.id).toString('base64url'),
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        device_type: verification.registrationInfo.credentialDeviceType,
      });

      await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'registration');

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    console.error('register-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
