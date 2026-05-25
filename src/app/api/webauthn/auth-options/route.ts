import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getWebAuthnFromRequest } from '@/lib/webauthn-config';

export async function POST(request: Request) {
  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { rpID } = getWebAuthnFromRequest(request);
  if (!rpID) {
    return NextResponse.json({ error: 'WebAuthn rpID not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  const { data: passkeys } = await supabase
    .from('passkeys')
    .select('credential_id')
    .eq('user_id', userId);

  if (!passkeys || passkeys.length === 0) {
    return NextResponse.json({ error: 'No passkeys found' }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: passkeys.map((p) => ({
      id: p.credential_id,
      type: 'public-key' as const,
    })),
  });

  const { error: challengeError } = await supabase.from('webauthn_challenges').upsert(
    {
      user_id: userId,
      challenge: options.challenge,
      type: 'authentication',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,type' }
  );

  if (challengeError) {
    console.error('webauthn_challenges upsert:', challengeError);
    return NextResponse.json({ error: 'Challenge storage failed' }, { status: 500 });
  }

  return NextResponse.json(options);
}
