import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const origin = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '');

export async function POST(request: Request) {
  const { userId, response } = await request.json();

  // Retrieve challenge from server — never accept from client
  const { data: challengeRow } = await supabaseAdmin
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', userId)
    .eq('type', 'registration')
    .maybeSingle();

  if (!challengeRow) {
    return NextResponse.json({ verified: false, error: 'No pending challenge found' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
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

      // Clean up used challenge
      await supabaseAdmin.from('webauthn_challenges')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'registration');

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('register-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
