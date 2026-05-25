import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getAuthUser, unauthorized } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRpId } from '@/lib/webauthn-config';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { userId, email } = await request.json();
  if (!userId || authUser.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const rpID = getRpId();

  const { data: existingPasskeys } = await supabase
    .from('passkeys')
    .select('credential_id')
    .eq('user_id', userId);

  const options = await generateRegistrationOptions({
    rpName: 'HariPrabodham',
    rpID,
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

  await supabase.from('webauthn_challenges').upsert(
    {
      user_id: userId,
      challenge: options.challenge,
      type: 'registration',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,type' }
  );

  return NextResponse.json(options);
}
