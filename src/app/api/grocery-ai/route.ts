import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { text } = await request.json();

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `You are a grocery list parser. Extract all grocery items from the input and return ONLY a valid JSON array with no markdown, no code blocks, no explanation, no extra text whatsoever. Just the raw JSON array starting with [ and ending with ].

Each item must have:
- "name": the item name in clean English
- "quantity": the quantity/amount as a string, empty string if not mentioned

Rules:
- Ignore category headers, emojis, bullet points, dashes
- Clean up item names (remove extra spaces, special chars)
- Keep quantities as-is (e.g. "1 bag", "6 nang", "2 judhi", "4 pck")
- Return ONLY the JSON array, nothing else

Input:
${text}`,
      }],
      max_tokens: 1000,
      temperature: 0,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({ content });
}