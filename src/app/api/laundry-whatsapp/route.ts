import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    // Validate input
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Get environment variables
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!phoneId || !token) {
      return NextResponse.json(
        {
          error: 'Missing WhatsApp credentials',
          details: {
            phoneId: phoneId ? 'Set' : 'Missing',
            token: token ? 'Set' : 'Missing',
          },
        },
        { status: 500 }
      );
    }

    console.log('=== WhatsApp Message Request ===');
    console.log('To:', phone);
    console.log('Phone ID:', phoneId);
    console.log('Time:', new Date().toISOString());

    // Send to WhatsApp API
    const whatsappResponse = await fetch(
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

    const result = await whatsappResponse.json();

    console.log('=== WhatsApp Response ===');
    console.log(JSON.stringify(result, null, 2));

    // Return response
    return NextResponse.json({
      success: whatsappResponse.ok && !result.error,
      status: whatsappResponse.status,
      phone,
      whatsappResponse: result,
    });
  } catch (err: any) {
    console.error('=== Error ===');
    console.error(err);

    return NextResponse.json(
      {
        error: err.message,
        type: 'Server Error',
      },
      { status: 500 }
    );
  }
}