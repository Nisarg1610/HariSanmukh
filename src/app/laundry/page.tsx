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
import { AppHeader } from '@/components/AppHeader';

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
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-12 h-12 rounded-2xl overflow-hidden animate-pulse">
        <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
      </div>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading...</p>
    </main>
  );
}
 if (userRole === 'user') {
  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
    
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Laundry</h1>

        <div className="list-group">
          {/* Header */}
          <div
            className="px-4 py-3"
            style={{
              borderBottom: '0.5px solid var(--separator)',
              backgroundColor: 'var(--bg-card-2)',
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <span className="section-header" style={{ marginBottom: 0 }}>Day</span>
              <span className="section-header" style={{ marginBottom: 0 }}>Member</span>
            </div>
          </div>

          {DAYS.map((day, idx) => {
            const dayAssignments = assignments.filter((a) => a.day_of_week === day);
            const isMyDay = dayAssignments.some((a) => a.member_id === memberId);

            return (
              <div
                key={day}
                className="px-4 py-3.5"
                style={{
                  borderBottom: idx !== DAYS.length - 1
                    ? '0.5px solid var(--separator)'
                    : 'none',
                  backgroundColor: isMyDay ? 'var(--accent-bg)' : 'transparent',
                }}
              >
                <div className="grid grid-cols-2 gap-4 items-center">
                  <span
                    className="font-semibold text-sm"
                    style={{ color: isMyDay ? 'var(--accent-text)' : 'var(--text-1)' }}
                  >
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dayAssignments.length === 0 ? (
                      <span className="text-sm" style={{ color: 'var(--text-4)' }}>—</span>
                    ) : (
                      dayAssignments.map((a) => (
                        <span
                          key={a.id}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: a.member_id === memberId
                              ? 'var(--accent)'
                              : 'var(--bg-card-2)',
                            color: a.member_id === memberId
                              ? 'white'
                              : 'var(--text-2)',
                          }}
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
      {/* Ground Rules */}
<div className="card p-5">
  <div className="flex items-center gap-2 mb-3">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: 'var(--yellow-bg)' }}>
      <span className="text-base">📋</span>
    </div>
    <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>Ground Rules</h3>
  </div>
  <div className="space-y-2">
    {[
      '📲 Inform the WhatsApp group if you swap days with someone.',
      '💬 Missed your day? No stress — just communicate!',
      '🧴 Don\'t overuse detergent or overfill the dryer.',
      '🧹 Clean the lint tray gently after every dryer cycle.',
      '🟦 Use 1–3 dryer sheets depending on load size.',
      '🔔 Remind each other about laundry day!',
    ].map((rule, i) => (
      <div key={i} className="flex items-start gap-2.5">
        <span className="text-xs leading-5 flex-1"
          style={{ color: 'var(--text-2)' }}>
          {rule}
        </span>
      </div>
    ))}
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
    {/* Ground Rules */}
<div className="card p-5">
  <div className="flex items-center gap-2 mb-3">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: 'var(--yellow-bg)' }}>
      <span className="text-base">📋</span>
    </div>
    <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>Ground Rules</h3>
  </div>
  <div className="space-y-2">
    {[
      '📲 Inform in the WhatsApp group if you swap days with someone.',
      '💬 Missed your day? No stress — just communicate!',
      '🧴 Don\'t overuse detergent or overfill the dryer.',
      '🧹 Clean the lint tray gently after every dryer cycle.',
      '🟦 Use 1–3 dryer sheets depending on load size.',
      '🔔 Remind each other about laundry day!',
    ].map((rule, i) => (
      <div key={i} className="flex items-start gap-2.5">
        <span className="text-xs leading-5 flex-1"
          style={{ color: 'var(--text-2)' }}>
          {rule}
        </span>
      </div>
    ))}
  </div>
</div>
    <BottomNav isAdmin={true} />
  </main>
);
}