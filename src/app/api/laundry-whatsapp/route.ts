import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get ALL laundry assignments with phone — no day filter for testing
    const { data: assignments, error } = await supabase
      .from('laundry_assignments')
      .select(`
        member_id,
        day_of_week,
        household_members (
          first_name,
          phone
        )
      `);

    if (error) return NextResponse.json({ error: error.message });

    // Find your test member
 const testMember = assignments?.find(
  (a: any) => (a.household_members as any)?.phone !== null
);

if (!testMember) {
  return NextResponse.json({ 
    error: 'No member with phone found',
    assignments: assignments?.map((a: any) => ({
      name: (a.household_members as any)?.first_name,
      phone: (a.household_members as any)?.phone,
      day: a.day_of_week
    }))
  });
}

  const phone = (testMember.household_members as any)?.phone;
const name = (testMember.household_members as any)?.first_name;
    const message = `🙏 Jay Swaminarayan\n\n${name} Bhai, this is a test message from HariSanmukh!\n\nYour laundry is assigned on ${testMember.day_of_week}. This is how your reminder will look 👕`;

    // Send WhatsApp
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

    const result = await res.json();

    return NextResponse.json({
      success: true,
      sentTo: name,
      phone: phone,
      whatsappResponse: result,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}