import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const { userId, response, challenge } = await request.json();

  const credentialId = response.id;

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
      expectedChallenge: challenge,
      expectedOrigin: process.env.NEXT_PUBLIC_APP_URL!,
      expectedRPID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
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

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err: any) {
    console.error('auth-verify error:', err);
    return NextResponse.json({ verified: false, error: err.message });
  }
}
