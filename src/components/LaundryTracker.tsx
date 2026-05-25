'use client';

import { useState, useEffect, useRef } from 'react';
import { upsertLaundrySession, getTodayLaundrySessions } from '@/utils/laundry';
import { getAuthHeaders } from '@/utils/api';

interface LaundryTrackerProps {
  householdId: string;
  memberId: string;
  allLaundryDays: any[];
  initialSessions: any[];
}

const WASHER_MINS = 45;
const DRYER_MINS = 60;

/** Only auth user IDs (users table) — not household_members.id */
function linkedUserIds(rows: { household_members?: { linked_user_id?: string | null } | null }[]): string[] {
  return rows
    .map((u) => u.household_members?.linked_user_id)
    .filter((id): id is string => Boolean(id));
}

function getElapsedMins(startAt: string | null, now: Date): number {
  if (!startAt) return 0;
  return (now.getTime() - new Date(startAt).getTime()) / 60000;
}

function getMinsLeft(startAt: string | null, durationMins: number, now: Date): number {
  return Math.max(0, Math.ceil(durationMins - getElapsedMins(startAt, now)));
}

function isRunning(
  startAt: string | null,
  completedAt: string | null,
  durationMins: number,
  now: Date
): boolean {
  if (!startAt || completedAt) return false;
  return getElapsedMins(startAt, now) < durationMins;
}

function stopProp(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AllDone() {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--separator)]" onClick={stopProp}>
      <p className="text-[13px] font-bold text-center" style={{ color: 'var(--text-4)' }}>
        All Done! 🎉
      </p>
    </div>
  );
}

function RunningTimer({
  label,
  minsLeft,
  accent,
}: {
  label: string;
  minsLeft: number;
  accent: 'green' | 'blue';
}) {
  const color = accent === 'green' ? 'var(--accent)' : '#3b82f6';
  return (
    <div className="mt-4 pt-3 border-t border-[var(--separator)]" onClick={stopProp}>
      <p className="text-[12px] font-bold mb-1" style={{ color }}>
        {label}
      </p>
      <p className="text-[20px] font-extrabold text-[var(--text-1)]">
        {minsLeft} min{minsLeft !== 1 ? 's' : ''} left
      </p>
    </div>
  );
}

function WaitingBanner({ label, minsLeft }: { label: string; minsLeft: number }) {
  return (
    <div className="mt-4 pt-3 border-t border-[var(--separator)]" onClick={stopProp}>
      <p className="text-[12px] font-bold text-[var(--text-3)] mb-1">{label}</p>
      <p className="text-[16px] font-bold text-[var(--text-2)]">
        {minsLeft} min{minsLeft !== 1 ? 's' : ''} left
      </p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const styles = { bg: 'var(--green-bg)', color: '#1a6340' };

  return (
    <div className="mt-3" onClick={stopProp}>
      <button
        type="button"
        onClick={onClick}
        className="w-full py-2.5 rounded-[12px] text-[13px] font-extrabold shadow-sm active:scale-95 transition-all"
        style={{ backgroundColor: styles.bg, color: styles.color }}
      >
        {label}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LaundryTracker({
  householdId,
  memberId,
  allLaundryDays,
  initialSessions,
}: LaundryTrackerProps) {
  const [sessions, setSessions] = useState<any[]>(initialSessions);
  const [currentTime, setCurrentTime] = useState(new Date());
  const completingRef = useRef<Set<string>>(new Set());

  const dayOfWeek = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const hour = currentTime.getHours();
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
  const isActiveTime = isWeekend ? hour >= 6 : hour >= 18;

  const assignedToday = allLaundryDays.filter((a) => a.day_of_week === dayOfWeek);
  const amIAssignedToday = assignedToday.some((a) => a.member_id === memberId);

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll sessions every 5s when active
  useEffect(() => {
    if (!amIAssignedToday || !isActiveTime) return;
    const pollId = setInterval(async () => {
      const data = await getTodayLaundrySessions(householdId);
      setSessions(data);
    }, 5000);
    return () => clearInterval(pollId);
  }, [householdId, amIAssignedToday, isActiveTime]);

  // Auto-complete when timer expires
  useEffect(() => {
    if (!amIAssignedToday || !isActiveTime) return;
    const mySession = sessions.find((s) => s.member_id === memberId);
    if (!mySession) return;

    if (
      mySession.washer_started_at &&
      !mySession.washer_completed_at &&
      getElapsedMins(mySession.washer_started_at, currentTime) >= WASHER_MINS
    ) {
      const key = `washer-${mySession.washer_started_at}`;
      if (!completingRef.current.has(key)) {
        completingRef.current.add(key);
        completeTask('washer', mySession);
      }
    }

    if (
      mySession.dryer_started_at &&
      !mySession.dryer_completed_at &&
      getElapsedMins(mySession.dryer_started_at, currentTime) >= DRYER_MINS
    ) {
      const key = `dryer-${mySession.dryer_started_at}`;
      if (!completingRef.current.has(key)) {
        completingRef.current.add(key);
        completeTask('dryer', mySession);
      }
    }
  }, [currentTime, sessions]);

  if (!isActiveTime || !amIAssignedToday) return null;

  // ── Derived state ───────────────────────────────────────────────────────────

  const mySession = sessions.find((s) => s.member_id === memberId) ?? null;

  // My personal DB progress — read directly from DB, no timer math
  const iDidWasher = !!mySession?.washer_completed_at;
  const iDidDryer = !!mySession?.dryer_completed_at;

  // Global shared machine state — who is running what right now
  const washerRunningSession =
    sessions.find((s) =>
      isRunning(s.washer_started_at, s.washer_completed_at, WASHER_MINS, currentTime)
    ) ?? null;

  const dryerRunningSession =
    sessions.find((s) =>
      isRunning(s.dryer_started_at, s.dryer_completed_at, DRYER_MINS, currentTime)
    ) ?? null;

  const washerIsRunningByMe = washerRunningSession?.member_id === memberId;
  const dryerIsRunningByMe = dryerRunningSession?.member_id === memberId;

  // ── Render priority ─────────────────────────────────────────────────────────

  // 0. All done — DB has dryer_completed_at set, show instantly on any load
  if (iDidWasher && iDidDryer) {
    return <AllDone />;
  }

  // 1. My washer is running → show my washer timer
  if (washerIsRunningByMe) {
    const left = getMinsLeft(mySession!.washer_started_at, WASHER_MINS, currentTime);
    return <RunningTimer label="Washer running" minsLeft={left} accent="green" />;
  }

  // 2. My dryer is running → show my dryer timer
  if (dryerIsRunningByMe) {
    const left = getMinsLeft(mySession!.dryer_started_at, DRYER_MINS, currentTime);
    return <RunningTimer label="Dryer running" minsLeft={left} accent="blue" />;
  }

  // 3. I've done my washer but not dryer yet
  if (iDidWasher && !iDidDryer) {
    // Dryer busy by anyone (by this point it can only be someone else) → show wait timer
    if (dryerRunningSession) {
      const left = getMinsLeft(dryerRunningSession.dryer_started_at, DRYER_MINS, currentTime);
      return <WaitingBanner label="Dryer in use" minsLeft={left} />;
    }
    // Dryer is free → let me start it
    return (
      <ActionButton label="Start Dryer" onClick={() => handleStart('dryer')} />
    );
  }

  // 4. I haven't done my washer yet
  if (!iDidWasher) {
    // Washer busy by anyone (by this point it can only be someone else) → show wait timer
    if (washerRunningSession) {
      const left = getMinsLeft(washerRunningSession.washer_started_at, WASHER_MINS, currentTime);
      return <WaitingBanner label="Washer in use" minsLeft={left} />;
    }
    // Washer is free → let me start it
    return (
      <ActionButton label="Start Washer" onClick={() => handleStart('washer')} />
    );
  }

  return null;

  // ── Action handlers ─────────────────────────────────────────────────────────

  async function handleStart(type: 'washer' | 'dryer') {
    const today = new Date().toISOString().split('T')[0];
    const existing = { ...(sessions.find((s) => s.member_id === memberId) ?? {}) };
    delete existing.household_members;

    const newSess = {
      ...existing,
      household_id: householdId,
      member_id: memberId,
      date: today,
      ...(type === 'washer'
        ? { washer_started_at: new Date().toISOString(), washer_completed_at: null }
        : { dryer_started_at: new Date().toISOString(), dryer_completed_at: null }),
    };

    const res = await upsertLaundrySession(newSess);
    if (!res) return;

    const updated = await getTodayLaundrySessions(householdId);
    setSessions(updated);

    const myName =
      assignedToday.find((u) => u.member_id === memberId)?.household_members?.first_name ??
      'Someone';
    const otherAssigned = assignedToday.filter((u) => u.member_id !== memberId);
    const otherUserIds = linkedUserIds(otherAssigned);
    const myLinkedId = assignedToday.find((u) => u.member_id === memberId)?.household_members
      ?.linked_user_id;
    const allLinkedIds = linkedUserIds(assignedToday);

    const authHeaders = await getAuthHeaders();

    if (otherUserIds.length > 0) {
      const machineName = type === 'washer' ? 'Washer' : 'Dryer';
      Promise.all(
        otherUserIds.map((userId) =>
          fetch('/api/push-notify', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              userId,
              title: 'Laundry Tracking',
              body: `${myName} Bhai started the ${machineName}.`,
            }),
          }).catch(console.error)
        )
      );
    }

    if (type === 'washer' && myLinkedId) {
      fetch('/api/schedule-push', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          delayMins: WASHER_MINS,
          targetUserIds: [myLinkedId],
          msg: 'Your clothes are washed! Move them to the dryer.',
        }),
      }).catch(console.error);

      if (otherUserIds.length > 0) {
        fetch('/api/schedule-push', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            delayMins: WASHER_MINS,
            targetUserIds: otherUserIds,
            msg: 'Washer is now empty — your turn!',
          }),
        }).catch(console.error);
      }
    } else if (allLinkedIds.length > 0) {
      fetch('/api/schedule-push', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          delayMins: DRYER_MINS,
          targetUserIds: allLinkedIds,
          msg: 'Dryer is done — clothes are ready! 🎉',
        }),
      }).catch(console.error);
    }
  }

  async function completeTask(type: 'washer' | 'dryer', sess: any) {
    const today = new Date().toISOString().split('T')[0];
    const existing = { ...sess };
    delete existing.household_members;

    const newSess = {
      ...existing,
      household_id: householdId,
      member_id: memberId,
      date: today,
      ...(type === 'washer'
        ? { washer_completed_at: new Date().toISOString() }
        : { dryer_completed_at: new Date().toISOString() }),
    };

    const res = await upsertLaundrySession(newSess);
    if (res) {
      const updated = await getTodayLaundrySessions(householdId);
      setSessions(updated);
    }
  }
}