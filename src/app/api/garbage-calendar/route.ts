import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_RECYCLE_CALENDAR_ID = '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com';
const DEFAULT_GARBAGE_CALENDAR_ID = 'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com';

async function fetchCalendarEvents(calendarId: string, type: 'garbage' | 'recycle', apiKey: string) {
  const now = new Date();
  // Fetch from 30 days in the past to 60 days in the future
  const pastLimit = new Date();
  pastLimit.setDate(now.getDate() - 30);
  const futureLimit = new Date();
  futureLimit.setDate(now.getDate() + 60);

  const timeMin = pastLimit.toISOString();
  const timeMax = futureLimit.toISOString();

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY!;

    let recycleId = DEFAULT_RECYCLE_CALENDAR_ID;
    let garbageId = DEFAULT_GARBAGE_CALENDAR_ID;

    if (householdId) {
       const { data: config } = await getSupabaseAdmin()
         .from('house_configs')
         .select('garbage_calendar_id, recycle_calendar_id')
         .eq('household_id', householdId)
         .maybeSingle();
         
       if (config) {
          if (config.garbage_calendar_id) garbageId = config.garbage_calendar_id;
          if (config.recycle_calendar_id) recycleId = config.recycle_calendar_id;
       }
    }

    const [garbageEvents, recycleEvents] = await Promise.all([
      fetchCalendarEvents(garbageId, 'garbage', apiKey),
      fetchCalendarEvents(recycleId, 'recycle', apiKey),
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