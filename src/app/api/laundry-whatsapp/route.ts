import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-auth';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!phoneId || !token) {
      return NextResponse.json(
        { error: 'Missing WhatsApp credentials' },
        { status: 500 }
      );
    }

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' },
          },
        }),
      }
    );

    const result = await whatsappResponse.json();

    return NextResponse.json({
      success: whatsappResponse.ok && !result.error,
      status: whatsappResponse.status,
      phone,
      whatsappResponse: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server Error';
    console.error('laundry-whatsapp error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
