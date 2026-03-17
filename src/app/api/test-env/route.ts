import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    key: process.env.NEXT_PUBLIC_GROQ_API_KEY ? 'EXISTS' : 'MISSING',
    first10: process.env.NEXT_PUBLIC_GROQ_API_KEY?.substring(0, 10),
  });
}