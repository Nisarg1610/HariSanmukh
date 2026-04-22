import { NextResponse } from 'next/server';

// This is a simple background scheduler that works if the Next.js app 
// is running on a long-lived Node.js server (like a VPS or local PC).
// It will NOT work reliably on serverless platforms (like Vercel) which kill functions after a few seconds.

export async function POST(request: Request) {
  const body = await request.json();
  const { householdId, memberId, msg, delayMins } = body;

  const delayMs = delayMins * 60 * 1000;

  // We immediately return success to the client
  // But we leave a background timer running in the Node process.
  setTimeout(async () => {
    try {
      // Create a simulated request to our existing push-notify endpoint
      // We pass householdId = 'all' or we find the right members.
      // Wait, we can just call the push-notification logic here, or fetch the push-notify endpoint.
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://brampton-youths.vercel.app/';
      
      // We need to fetch the assigned members today to notify them
      // But Since we are server side, we can just fetch /api/push-notify for each user, 
      // or to make it simpler, the client already passed all target userIds or memberIds.
      
      if (body.targetUserIds && Array.isArray(body.targetUserIds)) {
         for (const userId of body.targetUserIds) {
           await fetch(`${baseUrl}/api/push-notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                title: 'Laundry Tracker',
                body: msg,
              })
           }).catch(() => {});
         }
      }
    } catch (err) {
      console.error('Scheduled push failed', err);
    }
  }, delayMs);

  return NextResponse.json({ scheduled: true, delayMins });
}
