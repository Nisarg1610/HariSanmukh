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

Return ONLY a raw JSON array. No markdown, no explanations.`
      },
      {
        role: 'user',
        content: `Input: ${text}`
      }],
      max_tokens: 1000,
      temperature: 0, // Crucial for consistency
      response_format: { type: "json_object" } 
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  
  // Note: Some models return a JSON object wrapping the array. 
  // You may need to parse and return content.items if you change the schema.
  return NextResponse.json({ content: JSON.parse(content) });
}