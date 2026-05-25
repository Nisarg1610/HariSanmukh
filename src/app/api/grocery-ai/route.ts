import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-auth';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'system',
          content: `You are a multilingual grocery list parser (English, Hindi, Gujarati).
        
### Rules:
1. Identify the item even if it is transliterated (e.g., "Dhana", "Bataka", "Aloo").
2. Translate the item to a standard English name first.
3. Categorize the item into ONLY: [Vegetables, Fruits, Dairy, Spices, Grains & Pulses, Snacks, Household].
4. If an item is ambiguous (like Dhana), default to "Vegetables" if it sounds like a fresh herb or "Spices" if it sounds like a dry seed.

### Examples for Training:
- Input: "500g Dhana" -> Output: {"name": "Coriander", "category": "Vegetables", "quantity": "500g"}
- Input: "1kg Bataka" -> Output: {"name": "Potato", "category": "Vegetables", "quantity": "1kg"}
- Input: "2L Dudh" -> Output: {"name": "Milk", "category": "Dairy", "quantity": "2L"}
- Input: "Chana Dal" -> Output: {"name": "Split Chickpeas", "category": "Grains & Pulses", "quantity": ""}

Return ONLY JSON in this exact format:
{"items":[{"name":"Milk","quantity":"2L"}]}
No markdown, no explanations.`
        },
        {
          role: 'user',
          content: `Input: ${text}`
        }],
        max_tokens: 1000,
        temperature: 0,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('grocery-ai upstream error', response.status, errText);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 });
    }

    return NextResponse.json({
      items: items
        .filter((item: { name?: string }) => item?.name)
        .map((item: { name: string; quantity?: string }) => ({
          name: String(item.name).trim(),
          quantity: String(item.quantity ?? '').trim(),
        })),
    });
  } catch (error) {
    console.error('grocery-ai route failed', error);
    return NextResponse.json({ error: 'Failed to process grocery list' }, { status: 500 });
  }
}
