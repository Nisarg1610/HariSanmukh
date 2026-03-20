import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message } = body;

    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!phoneId || !token) {
      return NextResponse.json({
        error: 'Missing environment variables',
        phoneId: phoneId ? 'Set' : 'Missing',
        token: token ? 'Set' : 'Missing',
      });
    }

    console.log('Sending WhatsApp message...');
    console.log('Phone:', phone);
    console.log('Phone ID:', phoneId);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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

    const result = await response.json();

    console.log('WhatsApp Response:', result);

    return NextResponse.json({
      success: !result.error,
      phone,
      response: result,
    });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({
      error: err.message,
    });
  }
}