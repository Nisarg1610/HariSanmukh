import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
<<<<<<< HEAD
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRpId } from '@/lib/webauthn-config';
=======
import { supabaseAdmin } from '@/lib/supabase-server';
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

export async function POST(request: Request) {
  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: passkeys } = await supabaseAdmin
    .from('passkeys')
    .select('credential_id')
    .eq('user_id', userId);

  if (!passkeys || passkeys.length === 0) {
    return NextResponse.json({ error: 'No passkeys found' }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpId(),
    userVerification: 'required',
    allowCredentials: passkeys.map((p) => ({
      id: p.credential_id,
      type: 'public-key' as const,
    })),
  });

<<<<<<< HEAD
  await supabase.from('webauthn_challenges').upsert(
    {
      user_id: userId,
      challenge: options.challenge,
      type: 'authentication',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,type' }
  );
=======
  // Store challenge server-side — never trust the client with it
  await supabaseAdmin.from('webauthn_challenges').upsert({
    user_id: userId,
    challenge: options.challenge,
    type: 'authentication',
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type' });
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

  return NextResponse.json(options);
}
