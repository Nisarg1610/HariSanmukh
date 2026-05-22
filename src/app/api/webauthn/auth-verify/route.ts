import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const origin = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '');

export async function POST(request: Request) {
  const { userId, response } = await request.json();

  const credentialId = response.id;

  const { data: passkey } = await supabaseAdmin
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
      expectedOrigin: origin,
      expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
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

      // Clean up used challenge
      await supabaseAdmin.from('webauthn_challenges')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'authentication');

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('auth-verify error:', err);
    return NextResponse.json({ verified: false, error: message });
  }
}
