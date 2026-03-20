import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function sendWhatsApp(phone: string, message: string) {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    }
  );
  return res.json();
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Detect 7pm or 10pm EST
  // 7pm EST = 23:00 UTC, 10pm EST = 02:00 UTC
  const hour = new Date().getUTCHours();
  const type = hour === 23 ? 'reminder' : 'checkup';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Get today's laundry assignments
  const { data: assignments, error } = await supabase
    .from('laundry_assignments')
    .select(`
      member_id,
      household_members (
        first_name,
        phone
      )
    `)
    .eq('day_of_week', today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ sent: 0, day: today });
  }

  let sent = 0;
  const errors: string[] = [];

  await Promise.all(
    assignments.map(async (a: any) => {
      const phone = a.household_members?.phone;
      const name = a.household_members?.first_name;
      if (!phone) return;

      // Clean phone number — remove spaces, dashes, plus
      const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

      const message = type === 'reminder'
        ? `🙏 Jay Swaminarayan\n\n${name} Bhai, you have laundry assigned today.\n\nPlease get it done! 👕`
        : `🙏 Jay Swaminarayan\n\n${name} Bhai, have you done your laundry yet?\n\nPlease complete it before sleeping 🌙`;

      try {
        const result = await sendWhatsApp(cleaned, message);
        if (result.error) {
          errors.push(`${name}: ${result.error.message}`);
        } else {
          sent++;
        }
      } catch (err: any) {
        errors.push(`${name}: ${err.message}`);
      }
    })
  );

  return NextResponse.json({ sent, errors, day: today, type });
}