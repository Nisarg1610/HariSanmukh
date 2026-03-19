import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const { userId } = await request.json();

  const { data: passkeys } = await supabase
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

  return NextResponse.json(options);
}