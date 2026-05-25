import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getWebAuthnFromRequest } from '@/lib/webauthn-config';

const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const { userId, response } = await request.json();
  if (!userId) {
    return NextResponse.json({ verified: false, error: 'userId required' });
  }

  const { origin, rpID } = getWebAuthnFromRequest(request);
  if (!origin || !rpID) {
    return NextResponse.json({ verified: false, error: 'WebAuthn origin/rpID not configured' });
  }

  const supabase = getSupabaseAdmin();
  const credentialId = response.id;

  const { data: challengeRow } = await supabase
    .from('webauthn_challenges')
    .select('challenge, created_at')
    .eq('user_id', userId)
    .eq('type', 'authentication')
    .maybeSingle();

  if (!challengeRow) {
    return NextResponse.json({ verified: false, error: 'No pending challenge' });
  }

  const age = Date.now() - new Date(challengeRow.created_at).getTime();
  if (age > CHALLENGE_MAX_AGE_MS) {
    await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'authentication');
    return NextResponse.json({ verified: false, error: 'Challenge expired' });
  }

  const { data: passkey } = await supabase
    .from('passkeys')
    .select('*')
    .eq('user_id', userId)
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (!passkey) {
    return NextResponse.json({ verified: false, error: 'Passkey not found' });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, 'base64url'),
        counter: passkey.counter,
      },
    });

    if (verification.verified) {
      await supabase
        .from('passkeys')
        .update({ counter: verification.authenticationInfo.newCounter })
        .eq('id', passkey.id);

      await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'authentication');

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    console.error('auth-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
