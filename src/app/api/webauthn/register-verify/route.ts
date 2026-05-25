import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
<<<<<<< HEAD
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
=======
import { supabaseAdmin } from '@/lib/supabase-server';

const origin = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '');

export async function POST(request: Request) {
  const { userId, response } = await request.json();

  // Retrieve challenge from server — never accept from client
  const { data: challengeRow } = await supabaseAdmin
    .from('webauthn_challenges')
    .select('challenge')
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
    .eq('user_id', userId)
    .eq('type', 'registration')
    .maybeSingle();

  if (!challengeRow) {
<<<<<<< HEAD
    return NextResponse.json({ verified: false, error: 'No pending challenge' });
  }

  const age = Date.now() - new Date(challengeRow.created_at).getTime();
  if (age > CHALLENGE_MAX_AGE_MS) {
    await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'registration');
    return NextResponse.json({ verified: false, error: 'Challenge expired' });
=======
    return NextResponse.json({ verified: false, error: 'No pending challenge found' });
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
<<<<<<< HEAD
      expectedOrigin: getExpectedOrigin(),
      expectedRPID: getRpId(),
=======
      expectedOrigin: origin,
      expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      await supabaseAdmin.from('passkeys').insert({
        user_id: userId,
        credential_id: Buffer.from(credential.id).toString('base64url'),
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        device_type: verification.registrationInfo.credentialDeviceType,
      });

<<<<<<< HEAD
      await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', 'registration');
=======
      // Clean up used challenge
      await supabaseAdmin.from('webauthn_challenges')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'registration');
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
    console.error('register-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
