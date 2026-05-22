import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const { userId, email } = await request.json();

  const { data: existingPasskeys } = await supabaseAdmin
    .from('passkeys')
    .select('credential_id')
    .eq('user_id', userId);

  const options = await generateRegistrationOptions({
    rpName: 'HariPrabodham',
    rpID: process.env.NEXT_PUBLIC_APP_DOMAIN!,
    userID: new TextEncoder().encode(userId),
    userName: email,
    attestationType: 'none',
    excludeCredentials: existingPasskeys?.map((p) => ({
      id: p.credential_id,
      type: 'public-key' as const,
    })) ?? [],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  // Store challenge server-side — never trust the client with it
  await supabaseAdmin.from('webauthn_challenges').upsert({
    user_id: userId,
    challenge: options.challenge,
    type: 'registration',
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type' });

  return NextResponse.json(options);
}
