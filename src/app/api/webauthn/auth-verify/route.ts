import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
<<<<<<< HEAD
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getExpectedOrigin, getRpId } from '@/lib/webauthn-config';

const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const { userId, response } = await request.json();
  if (!userId) {
    return NextResponse.json({ verified: false, error: 'userId required' });
  }
=======
import { supabaseAdmin } from '@/lib/supabase-server';

const origin = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '');

export async function POST(request: Request) {
  const { userId, response } = await request.json();
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

  const supabase = getSupabaseAdmin();
  const credentialId = response.id;

<<<<<<< HEAD
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
=======
  const { data: passkey } = await supabaseAdmin
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
    .from('passkeys')
    .select('*')
    .eq('user_id', userId)
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (!passkey) {
    return NextResponse.json({ verified: false, error: 'Passkey not found' });
  }

  // Retrieve challenge from server — never accept from client
  const { data: challengeRow } = await supabaseAdmin
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', userId)
    .eq('type', 'authentication')
    .maybeSingle();

  if (!challengeRow) {
    return NextResponse.json({ verified: false, error: 'No pending challenge found' });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
<<<<<<< HEAD
      expectedOrigin: getExpectedOrigin(),
      expectedRPID: getRpId(),
=======
      expectedOrigin: origin,
      expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, 'base64url'),
        counter: passkey.counter,
      },
    });

    if (verification.verified) {
      await supabaseAdmin
        .from('passkeys')
        .update({ counter: verification.authenticationInfo.newCounter })
        .eq('id', passkey.id);

<<<<<<< HEAD
      await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'authentication');
=======
      // Clean up used challenge
      await supabaseAdmin.from('webauthn_challenges')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'authentication');
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err: unknown) {
<<<<<<< HEAD
    const message = err instanceof Error ? err.message : 'Verification failed';
=======
    const message = err instanceof Error ? err.message : 'Unknown error';
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
    console.error('auth-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
