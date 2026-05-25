'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, ChevronLeft } from 'lucide-react';
import {
  DAYS,
  getPickupDropAssignments,
  assignPickupDrop,
  removePickupDropAssignment,
} from '@/utils/pickupDrop';
import { getHouseholdMembers } from '@/utils/members';
import { useRouter } from 'next/navigation';

export default function PickupDropPage() {
  const router = useRouter();
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
      getPickupDropAssignments(hId),
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

  const handleMemberTap = (mId: string) => {
    setSelectedMemberId(prev => prev === mId ? null : mId);
  };

  const handleDayTap = async (day: string) => {
    if (!selectedMemberId) return;
    const alreadyAssigned = assignments.some(
      (a) => a.member_id === selectedMemberId && a.day_of_week === day
    );
    if (alreadyAssigned) { setSelectedMemberId(null); return; }
    const result = await assignPickupDrop(householdId, selectedMemberId, day);
    if (result) await fetchAll(householdId);
    setSelectedMemberId(null);
  };

  const handleRemove = async (assignmentId: string) => {
    await removePickupDropAssignment(assignmentId);
    await fetchAll(householdId);
  };

  if (loading) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4 app-page"
       
      >
        <div className="w-12 h-12 rounded-2xl overflow-hidden animate-pulse">
          <img src="/icon-256.png" alt="HariPrabodham" className="w-full h-full object-cover" />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading...</p>
      </main>
    );
  }

  // ── USER VIEW ───────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main className="min-h-screen pb-28 app-page">
        <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Pick & Drop</h1>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
          <section
            className="rounded-3xl p-5 text-white shadow-sm"
            style={{ background: 'linear-gradient(140deg, #f97316 0%, #f59e0b 100%)' }}
          >
            <p className="text-xl font-extrabold">Pick & Drop</p>
            <p className="text-sm font-medium text-white/85 mt-1">
              See who's assigned to pick up or drop off this week.
            </p>
          </section>

          <div className="card rounded-[24px] border border-[var(--separator)] overflow-hidden shadow-sm bg-[var(--bg-card)]">
            {DAYS.map((day, idx) => {
              const dayAssignments = assignments.filter((a) => a.day_of_week === day);
              const isMyDay = dayAssignments.some((a) => a.member_id === memberId);

              return (
                <div
                  key={day}
                  className="px-5 py-4 transition-all"
                  style={{
                    borderBottom: idx !== DAYS.length - 1 ? '1px solid var(--separator)' : 'none',
                    backgroundColor: isMyDay ? 'var(--accent-bg)' : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="font-extrabold text-[15px]"
                        style={{ color: isMyDay ? 'var(--accent)' : 'var(--text-1)' }}
                      >
                        {day}
                        {isMyDay && <span className="ml-2 text-lg">🚗</span>}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {dayAssignments.length === 0 ? (
                        <span className="text-[13px] italic" style={{ color: 'var(--text-4)' }}>No one</span>
                      ) : (
                        dayAssignments.map((a) => (
                          <span
                            key={a.id}
                            className="px-3 py-1.5 rounded-[10px] text-[12px] font-bold shadow-sm"
                            style={{
                              backgroundColor: a.member_id === memberId ? 'var(--accent)' : 'var(--bg-card-2)',
                              color: a.member_id === memberId ? 'var(--bg)' : 'var(--text-2)',
                              border: a.member_id !== memberId ? '1px solid var(--separator)' : 'none',
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
      </main>
    );
  }

  // ── ADMIN VIEW ──────────────────────────────────────────────
  const unassignedMembers = members.filter(
    (member) => !assignments.some((a) => a.member_id === member.id)
  );

  return (
    <main className="min-h-screen pb-28 app-page">
      <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Pick & Drop Schedule</h1>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        <section
          className="rounded-3xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(140deg, #f97316 0%, #f59e0b 100%)' }}
        >
          <p className="text-xl font-extrabold">Pick & Drop Schedule</p>
          <p className="text-sm font-medium text-white/85 mt-1">
            Assign who picks up or drops off members for sabha each day.
          </p>
        </section>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-1)' }}>Pick & Drop</h1>
        </div>

        {error && (
          <div className="p-4 rounded-[20px] shadow-sm flex gap-3 items-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
            <span className="text-xl">⚠️</span>
            <p className="text-[13px] font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* Member pool */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--text-1)' }} />
            <h2 className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Who Needs A Day?</h2>
          </div>

          <div className="card rounded-[24px] p-5 border border-[var(--separator)] bg-[var(--bg-card)] shadow-sm">
            {unassignedMembers.length === 0 ? (
              <div className="text-center py-4">
                <span className="text-3xl mb-3 block opacity-50">✨</span>
                <p className="text-[14px] font-bold" style={{ color: 'var(--green)' }}>
                  Everyone has been assigned a pick & drop day!
                </p>
              </div>
            ) : (
              <>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-4 text-center" style={{ color: 'var(--text-3)' }}>
                  {selectedMemberId ? 'Tap a day below to assign' : 'Tap a member to assign'}
                </p>
                <div className="flex justify-center flex-wrap gap-2.5">
                  {unassignedMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleMemberTap(member.id)}
                      className="px-4 py-2.5 rounded-[12px] text-[13px] font-bold transition-all select-none shadow-sm"
                      style={{
                        backgroundColor: selectedMemberId === member.id ? 'var(--accent)' : 'var(--bg-card-2)',
                        color: selectedMemberId === member.id ? 'var(--bg)' : 'var(--text-2)',
                        border: selectedMemberId === member.id ? 'none' : '1px solid var(--separator)',
                        transform: selectedMemberId === member.id ? 'translateY(-2px)' : 'none',
                        boxShadow: selectedMemberId === member.id ? '0 8px 16px -6px var(--accent)' : 'none',
                      }}
                    >
                      {member.first_name} Bhai
                      {selectedMemberId === member.id && <span className="ml-1.5 opacity-80">👆</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Days Loop */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1 mt-6">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
            <h2 className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Schedule Map</h2>
          </div>

          <div className="card rounded-[24px] border border-[var(--separator)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
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
                  className="flex items-center justify-between px-5 py-4 transition-all"
                  style={{
                    borderBottom: idx !== DAYS.length - 1 ? '1px solid var(--separator)' : 'none',
                    cursor: canAssign && !alreadyAssignedToDay ? 'pointer' : canAssign && alreadyAssignedToDay ? 'not-allowed' : 'default',
                    opacity: canAssign && alreadyAssignedToDay ? 0.4 : 1,
                    backgroundColor: canAssign && !alreadyAssignedToDay && dayAssignments.length === 0
                      ? 'var(--accent-bg)'
                      : canAssign && !alreadyAssignedToDay
                      ? 'rgba(0,0,0,0.02)'
                      : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-[15px] w-24 shrink-0" style={{ color: 'var(--text-1)' }}>
                      {day}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {dayAssignments.length === 0 ? (
                      <span
                        className="text-[12px] font-extrabold uppercase px-2.5 py-1 rounded-[8px] bg-[var(--bg-card-2)]"
                        style={{
                          color: canAssign && !alreadyAssignedToDay ? 'var(--accent)' : 'var(--text-4)',
                          border: canAssign && !alreadyAssignedToDay ? '1px dashed var(--accent)' : 'none',
                        }}
                      >
                        {canAssign && !alreadyAssignedToDay ? '+ DROP HERE' : 'Empty'}
                      </span>
                    ) : (
                      <>
                        {dayAssignments.map((a) => (
                          <div
                            key={a.id}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-bold shadow-sm"
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-1)',
                              border: '1px solid var(--border-strong)',
                            }}
                          >
                            {a.household_members?.first_name} Bhai
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemove(a.id); }}
                              className="ml-0.5 p-0.5 rounded-md hover:bg-[var(--red-bg)] text-[var(--red)] transition-colors"
                            >
                              <X size={12} strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                        {canAssign && !alreadyAssignedToDay && (
                          <span className="text-[12px] self-center ml-1 font-extrabold px-2 rounded-md" style={{ color: 'var(--accent)' }}>
                            + ADD
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
