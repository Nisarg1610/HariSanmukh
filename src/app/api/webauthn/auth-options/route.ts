import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const { userId } = await request.json();

  const { data: passkeys } = await supabaseAdmin
    .from('passkeys')
    .select('credential_id')
    .eq('user_id', userId);

  if (!passkeys || passkeys.length === 0) {
    return NextResponse.json({ error: 'No passkeys found' }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
    userVerification: 'required',
    allowCredentials: passkeys.map((p) => ({
      id: p.credential_id,
      type: 'public-key' as const,
    })),
  });

  // Store challenge server-side — never trust the client with it
  await supabaseAdmin.from('webauthn_challenges').upsert({
    user_id: userId,
    challenge: options.challenge,
    type: 'authentication',
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type' });

  return NextResponse.json(options);
}
