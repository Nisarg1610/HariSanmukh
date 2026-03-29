'use client';

import { useState, useEffect } from 'react';
import { upsertLaundrySession, getTodayLaundrySessions } from '@/utils/laundry';

interface LaundryTrackerProps {
  householdId: string;
  memberId: string;
  allLaundryDays: any[];
  initialSessions: any[];
}

export function LaundryTracker({ householdId, memberId, allLaundryDays, initialSessions }: LaundryTrackerProps) {
  const [sessions, setSessions] = useState<any[]>(initialSessions);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if >= 6 PM and member is assigned today
  const isAfter6PM = currentTime.getHours() >= 18;
  const dayOfWeek = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const assignedToday = allLaundryDays.filter(a => a.day_of_week === dayOfWeek);
  const amIAssignedToday = assignedToday.some(a => a.member_id === memberId);
  const isSolo = assignedToday.length === 1;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll sessions if active
  useEffect(() => {
    if (!amIAssignedToday || !isAfter6PM) return;
    const fetchIt = async () => {
      const data = await getTodayLaundrySessions(householdId);
      setSessions(data);
    };
    const pollId = setInterval(fetchIt, 5000);
    return () => clearInterval(pollId);
  }, [householdId, amIAssignedToday, isAfter6PM]);

  if (!isAfter6PM || !amIAssignedToday) return null;

  const mySession = sessions.find(s => s.member_id === memberId) || null;
  const otherSessions = sessions.filter(s => s.member_id !== memberId);

  // Logic for the other person
  const isSomeoneElseUsingWasher = otherSessions.some(s => {
    if (!s.washer_started_at) return false;
    const elapsedMins = (currentTime.getTime() - new Date(s.washer_started_at).getTime()) / 60000;
    return elapsedMins < 1 && !s.washer_completed_at;
  });

  const getRunningSession = (sess: any) => {
    if (!sess) return null;
    if (sess.washer_started_at && !sess.washer_completed_at) {
      const elapsedMins = (currentTime.getTime() - new Date(sess.washer_started_at).getTime()) / 60000;
      if (elapsedMins < 1) return { type: 'Washer', elapsedMins, start: new Date(sess.washer_started_at) };
    }
    if (sess.dryer_started_at && !sess.dryer_completed_at) {
      const elapsedMins = (currentTime.getTime() - new Date(sess.dryer_started_at).getTime()) / 60000;
      if (elapsedMins < 2) return { type: 'Dryer', elapsedMins, start: new Date(sess.dryer_started_at) };
    }
    return null;
  };

  const myRunning = getRunningSession(mySession);

  // Auto-complete checker. We use a function because we don't want infinite loops in render
  // Instead, maybe fire it via side-effect or inline is OK for simple upserts if debounced?
  // Better: don't auto-complete on render, rely on the button push or timer effect.

  // Let's do timer checks safely:
  useEffect(() => {
    if (!mySession) return;
    if (mySession.washer_started_at && !mySession.washer_completed_at) {
      const elapsedMins = (currentTime.getTime() - new Date(mySession.washer_started_at).getTime()) / 60000;
      if (elapsedMins >= 1) {
        completeTask('washer');
        notifyBoth('Washer has been done.');
      }
    }
    if (mySession.dryer_started_at && !mySession.dryer_completed_at) {
      const elapsedMins = (currentTime.getTime() - new Date(mySession.dryer_started_at).getTime()) / 60000;
      if (elapsedMins >= 2) {
        completeTask('dryer');
        notifySelf('Your laundry has been done.');
      }
    }
  }, [currentTime, mySession]);

  const notifyBoth = async (msg: string) => {
    // Ideally we would hit /api/push-notify for both users.
    // For now we just call it for everyone in `assignedToday`
    try {
      await Promise.all(assignedToday.map(user =>
        fetch('/api/push-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.household_members.linked_user_id || user.member_id,
            title: 'Laundry Update',
            body: msg,
          }),
        }).catch(() => { })
      ));
    } catch { }
  };

  const notifySelf = async (msg: string) => {
    try {
      const me = assignedToday.find(u => u.member_id === memberId);
      if (me) {
        await fetch('/api/push-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: me.household_members.linked_user_id || me.member_id,
            title: 'Laundry Update',
            body: msg,
          }),
        });
      }
    } catch { }
  };

  const handleStart = async (type: 'washer' | 'dryer') => {
    const today = new Date().toISOString().split('T')[0];
    const existing = sessions.find(s => s.member_id === memberId) || {};
    const newSess = {
      ...existing,
      household_id: householdId,
      member_id: memberId,
      date: today,
      ...(type === 'washer' ? { washer_started_at: new Date().toISOString(), washer_completed_at: null } : {}),
      ...(type === 'dryer' ? { dryer_started_at: new Date().toISOString(), dryer_completed_at: null } : {}),
    };
    delete newSess.household_members;

    const res = await upsertLaundrySession(newSess);
    if (res) {
      const updated = await getTodayLaundrySessions(householdId);
      setSessions(updated);

      // Schedule real-world background push notification
      const myLinkedId = assignedToday.find(u => u.member_id === memberId)?.household_members?.linked_user_id || memberId;
      const targetUserIds = type === 'washer'
        ? assignedToday.map(user => user.household_members?.linked_user_id || user.member_id)
        : [myLinkedId];

      fetch('/api/schedule-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delayMins: type === 'washer' ? 1 : 2,
          msg: type === 'washer' ? 'Washer has been done!' : 'Your laundry has been done.',
          targetUserIds
        }),
      }).catch(console.error);
    }
  };



  const completeTask = async (type: 'washer' | 'dryer') => {
    const today = new Date().toISOString().split('T')[0];
    const existing = sessions.find(s => s.member_id === memberId) || {};
    const newSess = {
      ...existing,
      household_id: householdId,
      member_id: memberId,
      date: today,
      ...(type === 'washer' ? { washer_completed_at: new Date().toISOString() } : {}),
      ...(type === 'dryer' ? { dryer_completed_at: new Date().toISOString() } : {}),
    };
    delete newSess.household_members;
    const res = await upsertLaundrySession(newSess);
    if (res) {
      const updated = await getTodayLaundrySessions(householdId);
      setSessions(updated);
    }
  };

  // Determine what button I should see
  let showWasherBtn = false;
  let showDryerBtn = false;

  const hasDidWasher = !!mySession?.washer_completed_at;
  const hasDidDryer = !!mySession?.dryer_completed_at;

  const amIWaitingForWasher = !myRunning && !hasDidWasher;

  // Render timer if running
  if (myRunning) {
    const total = myRunning.type === 'Washer' ? 1 : 2;
    const left = Math.max(0, Math.ceil(total - myRunning.elapsedMins));
    return (
      <div className="mt-4 pt-3 border-t border-[var(--separator)]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <p className="text-[12px] font-bold text-[var(--accent)] mb-1">{myRunning.type} Running</p>
        <p className="text-[20px] font-extrabold text-[var(--text-1)]">{left} mins left</p>
      </div>
    );
  }

  // If we are waiting for someone else's washer
  if (isSomeoneElseUsingWasher && amIWaitingForWasher) {
    const otherSess = otherSessions.find(s => s.washer_started_at && !s.washer_completed_at);
    if (otherSess) {
      const elapsedMins = (currentTime.getTime() - new Date(otherSess.washer_started_at).getTime()) / 60000;
      const left = Math.max(0, Math.ceil(1 - elapsedMins));
      return (
        <div className="mt-4 pt-3 border-t border-[var(--separator)]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <p className="text-[12px] font-bold text-[var(--text-3)] mb-1">Washer in Use</p>
          <p className="text-[16px] font-bold text-[var(--text-2)]">{left} mins left</p>
        </div>
      );
    }
  }

  if (!hasDidWasher) showWasherBtn = true;
  else if (!hasDidDryer) showDryerBtn = true;

  if (hasDidDryer) {
    return (
      <div className="mt-3 pt-3 border-t border-[var(--separator)]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <p className="text-[13px] font-bold text-center" style={{ color: 'var(--text-4)' }}>All Done!</p>
      </div>
    );
  }

  return (
    <div className="mt-3" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      {showWasherBtn && (
        <button
          type="button"
          onClick={() => handleStart('washer')}
          className="w-full py-2.5 rounded-[12px] text-[13px] font-extrabold text-[#1a6340] shadow-sm active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--green-bg)' }}
        >
          Start Washer
        </button>
      )}
      {!showWasherBtn && showDryerBtn && (
        <button
          type="button"
          onClick={() => handleStart('dryer')}
          className="w-full py-2.5 mt-2 rounded-[12px] text-[13px] font-extrabold text-[var(--accent)] shadow-sm active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent-bg)' }}
        >
          Start Dryer
        </button>
      )}
    </div>
  );
}
