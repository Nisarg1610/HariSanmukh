import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-auth';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { items } = await request.json();

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `You are a grocery categorization assistant. Users speak Gujarati, Hindi, and English. 
          Categorize items into exactly these categories:
          - Vegetables & Fruits (e.g. tamatar, kanda, aloo, apple, mango, keri, batata)
          - Dairy (e.g. dahi, yogurt, milk, dudh, paneer, cheese, butter, makhan, ghee)
          - Frozen (e.g. frozen peas, ice cream, frozen food)
          - Spices (e.g. haldi, turmeric, mirchi, jeera, cumin, dhaniya, garam masala, hing)
          - Other (anything that doesn't fit above categories)
          
          Return ONLY a JSON array, no extra text:
          [{"category": "Dairy", "name": "Dahi", "quantity": "1kg"}, ...]
          
          Keep the original item name as given. Do not translate it.`,
        },
        {
          role: 'user',
          content: `Categorize these grocery items: ${JSON.stringify(items)}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json({ items: parsed });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
