import { NextResponse } from 'next/server';

const RECYCLE_CALENDAR_ID = '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com';
const GARBAGE_CALENDAR_ID = 'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com';

async function fetchCalendarEvents(calendarId: string, type: 'garbage' | 'recycle', apiKey: string) {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`
  );

  const data = await res.json();
  return (data.items ?? []).map((event: any) => ({
    title: event.summary,
    date: event.start?.date ?? event.start?.dateTime?.split('T')[0],
    type,
  }));
}

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY!;

    const [garbageEvents, recycleEvents] = await Promise.all([
      fetchCalendarEvents(GARBAGE_CALENDAR_ID, 'garbage', apiKey),
      fetchCalendarEvents(RECYCLE_CALENDAR_ID, 'recycle', apiKey),
    ]);

    const events = [...garbageEvents, ...recycleEvents].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({ events });
  } catch (err) {
    console.error('Calendar error:', err);
    return NextResponse.json({ events: [] });
  }
}