import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'system',
          content: `You are a strict, highly accurate multilingual grocery list parser (English, Hindi, Gujarati).
        
### Strict Rules:
1. Parse the user's input and extract EVERY item mentioned. DO NOT skip or remove any items.
2. DO NOT add any extra items that are not present in the user's input.
3. Identify the item even if it is transliterated in English script (e.g., "Dhana", "Bataka", "Aloo"). Translate recognized items to a standard English name.
4. Categorize the item into ONLY ONE of these: [Vegetables, Fruits, Dairy, Spices, Grains & Pulses, Snacks, Household, Uncategorized].
5. CRITICAL: If you are unable to understand or translate an item, DO NOT remove it. Keep the original exact text as the "name" and set its category to "Uncategorized".

### Examples for Training:
- Input: "500g Dhana, 1kg Bataka, 2L Dudh, Chana Dal, some randomstuff" 
- Output: 
{
  "items": [
    {"name": "Coriander", "category": "Vegetables", "quantity": "500g"},
    {"name": "Potato", "category": "Vegetables", "quantity": "1kg"},
    {"name": "Milk", "category": "Dairy", "quantity": "2L"},
    {"name": "Split Chickpeas", "category": "Grains & Pulses", "quantity": ""},
    {"name": "some randomstuff", "category": "Uncategorized", "quantity": ""}
  ]
}

Return ONLY a JSON object with an "items" array in this exact format. No markdown, no conversational text, no explanations.`
        },
        {
          role: 'user',
          content: `Input: ${text}`
        }],
        max_tokens: 1000,
        temperature: 0, // Keep at 0 for strict, deterministic output
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

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse JSON from AI:', content);
      return NextResponse.json({ error: 'Invalid JSON returned from AI' }, { status: 500 });
    }

    const items = Array.isArray(parsed) ? parsed : parsed?.items;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid AI response format: missing items array' }, { status: 500 });
    }

    // Clean and validate the final mapped data
    return NextResponse.json({
      items: items
        .filter((item: any) => item?.name) // Ensure the item at least has a name
        .map((item: any) => ({
          name: String(item.name).trim(),
          category: String(item.category ?? 'Uncategorized').trim(), // Added category mapping
          quantity: String(item.quantity ?? '').trim(),
        })),
    });
  } catch (error) {
    console.error('grocery-ai route failed', error);
    return NextResponse.json({ error: 'Failed to process grocery list' }, { status: 500 });
  }
}