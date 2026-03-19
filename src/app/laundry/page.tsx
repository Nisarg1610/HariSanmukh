'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { X } from 'lucide-react';
import {
  DAYS,
  getLaundryAssignments,
  assignLaundry,
  removeLaundryAssignment,
} from '@/utils/laundry';
import { getHouseholdMembers } from '@/utils/members';

export default function LaundryPage() {
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const fetchAll = async (hId: string) => {
    const [a, m] = await Promise.all([
      getLaundryAssignments(hId),
      getHouseholdMembers(hId),
    ]);
    setAssignments(a);
    setMembers(m.filter((mem: any) => mem.status === 'active'));
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { window.location.href = '/'; return; }

        const { data: dbUser } = await supabase
          .from('users').select('*').eq('id', session.user.id).maybeSingle();
        if (!dbUser) { window.location.href = '/'; return; }

        setHouseholdId(dbUser.household_id);
        setUserRole(dbUser.role);

        // Get member id by email
        const { data: memberCard } = await supabase
          .from('household_members').select('id')
          .eq('email', session.user.email!).maybeSingle();
        if (memberCard) setMemberId(memberCard.id);

        await fetchAll(dbUser.household_id);
      } catch (err) {
        console.error(err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleMemberTap = (memberId: string) => {
    setSelectedMemberId(prev => prev === memberId ? null : memberId);
  };

  const handleDayTap = async (day: string) => {
    if (!selectedMemberId) return;
    const alreadyAssigned = assignments.some(
      (a) => a.member_id === selectedMemberId && a.day_of_week === day
    );
    if (alreadyAssigned) { setSelectedMemberId(null); return; }
    const result = await assignLaundry(householdId, selectedMemberId, day);
    if (result) await fetchAll(householdId);
    setSelectedMemberId(null);
  };

  const handleRemove = async (assignmentId: string) => {
    await removeLaundryAssignment(assignmentId);
    await fetchAll(householdId);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse">
          <span className="text-white text-xl">👕</span>
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
      </main>
    );
  }

  // ── USER VIEW ──────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main
        className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Laundry</h1>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="grid grid-cols-2 gap-4">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Day</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Member</span>
              </div>
            </div>

            {DAYS.map((day, idx) => {
              const dayAssignments = assignments.filter((a) => a.day_of_week === day);
              const isMyDay = dayAssignments.some((a) => a.member_id === memberId);

              return (
                <div
                  key={day}
                  className={`px-4 py-3.5 ${idx !== DAYS.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''} ${isMyDay ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <span className={`font-semibold text-sm ${isMyDay ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                      {day}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {dayAssignments.length === 0 ? (
                        <span className="text-gray-300 dark:text-gray-700 text-sm">—</span>
                      ) : (
                        dayAssignments.map((a) => (
                          <span
                            key={a.id}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              a.member_id === memberId
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {a.household_members?.first_name} Bhai
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ── ADMIN VIEW ─────────────────────────────────────────────
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const unassignedMembers = members.filter(
    (member) => !assignments.some((a) => a.member_id === member.id)
  );

  return (
  <main
    className="min-h-screen pb-28"
    style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
  >
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

      <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Laundry</h1>

      {error && (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--red-bg)', border: '0.5px solid var(--red)' }}
        >
          <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Member pool */}
      <div className="list-group p-4">
        <p className="section-header mb-3">
          {selectedMemberId
            ? `${selectedMember?.first_name} Bhai selected — tap a day`
            : unassignedMembers.length === 0
            ? '✓ All members assigned'
            : 'Tap a member then tap a day'}
        </p>
        {unassignedMembers.length === 0 ? (
          <p className="text-sm font-medium" style={{ color: 'var(--green)' }}>
            Everyone has been assigned a laundry day!
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unassignedMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => handleMemberTap(member.id)}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all select-none"
                style={{
                  backgroundColor: selectedMemberId === member.id
                    ? 'var(--accent)'
                    : 'var(--accent-bg)',
                  color: selectedMemberId === member.id
                    ? 'white'
                    : 'var(--accent-text)',
                  transform: selectedMemberId === member.id ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: selectedMemberId === member.id
                    ? '0 4px 12px rgba(56, 76, 101, 0.25)'
                    : 'none',
                }}
              >
                {member.first_name} Bhai
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Days */}
      <div className="list-group">
        {DAYS.map((day, idx) => {
          const dayAssignments = assignments.filter((a) => a.day_of_week === day);
          const canAssign = selectedMemberId !== null;
          const alreadyAssignedToDay = assignments.some(
            (a) => a.member_id === selectedMemberId && a.day_of_week === day
          );

          return (
            <div
              key={day}
              onClick={() => handleDayTap(day)}
              className="flex items-center gap-3 px-4 py-4 transition-all"
              style={{
                borderBottom: idx !== DAYS.length - 1
                  ? '0.5px solid var(--separator)'
                  : 'none',
                cursor: canAssign && !alreadyAssignedToDay
                  ? 'pointer'
                  : canAssign && alreadyAssignedToDay
                  ? 'not-allowed'
                  : 'default',
                opacity: canAssign && alreadyAssignedToDay ? 0.4 : 1,
                backgroundColor: canAssign && !alreadyAssignedToDay && dayAssignments.length === 0
                  ? 'var(--accent-bg)'
                  : 'transparent',
              }}
              onMouseEnter={e => {
                if (canAssign && !alreadyAssignedToDay)
                  e.currentTarget.style.backgroundColor = 'var(--accent-bg)';
              }}
              onMouseLeave={e => {
                if (canAssign && !alreadyAssignedToDay && dayAssignments.length > 0)
                  e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Day name */}
              <span
                className="font-semibold text-sm w-24 shrink-0"
                style={{ color: 'var(--text-1)' }}
              >
                {day}
              </span>

              {/* Assignments */}
              <div className="flex flex-wrap gap-1.5 flex-1">
                {dayAssignments.length === 0 ? (
                  <span
                    className="text-xs"
                    style={{
                      color: canAssign && !alreadyAssignedToDay
                        ? 'var(--accent)'
                        : 'var(--text-4)',
                    }}
                  >
                    {canAssign && !alreadyAssignedToDay ? '+ tap to assign' : '—'}
                  </span>
                ) : (
                  <>
                    {dayAssignments.map((a) => (
                      <div
                        key={a.id}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: 'var(--accent-bg)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        {a.household_members?.first_name} Bhai
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(a.id); }}
                          className="ml-0.5 transition-colors"
                          style={{ color: 'var(--accent)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {canAssign && !alreadyAssignedToDay && (
                      <span
                        className="text-xs self-center"
                        style={{ color: 'var(--accent)' }}
                      >
                        + add
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
    <BottomNav isAdmin={true} />
  </main>
);
}