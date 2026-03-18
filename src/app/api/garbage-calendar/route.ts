import { NextResponse } from 'next/server';

export async function GET() {
  const calendarId = '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com';
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${firstDay}&timeMax=${lastDay}&singleEvents=true&orderBy=startTime`
  );

  const data = await response.json();
  const events = data.items?.map((event: any) => ({
    title: event.summary,
    date: event.start?.date ?? event.start?.dateTime,
  })) ?? [];

  return NextResponse.json({ events });
}