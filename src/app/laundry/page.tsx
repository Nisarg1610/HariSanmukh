'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [userFirstName, setUserFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [draggingMemberId, setDraggingMemberId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const fetchAll = async (hId: string) => {
    const [a, m] = await Promise.all([
      getLaundryAssignments(hId),
      getHouseholdMembers(hId),
    ]);
    setAssignments(a);
    setMembers(m.filter((m: any) => m.status === 'active'));
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
        setUserFirstName(dbUser.first_name);
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

  // ── Drag handlers ──────────────────────────────────────────
  const handleDragStart = (memberId: string) => {
    setDraggingMemberId(memberId);
  };

  const handleDragOver = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    setDragOverDay(day);
  };

  const handleDrop = async (e: React.DragEvent, day: string) => {
    e.preventDefault();
    setDragOverDay(null);
    if (!draggingMemberId) return;

    // Check if already assigned to this day
    const alreadyAssigned = assignments.some(
      (a) => a.member_id === draggingMemberId && a.day_of_week === day
    );
    if (alreadyAssigned) return;

    const result = await assignLaundry(householdId, draggingMemberId, day);
    if (result) {
      await fetchAll(householdId);
    }
    setDraggingMemberId(null);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleRemove = async (assignmentId: string) => {
    await removeLaundryAssignment(assignmentId);
    await fetchAll(householdId);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  // ── USER VIEW ──────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 pb-28">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Laundry</h1>

          <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Day</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Member</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => {
                  const dayAssignments = assignments.filter((a) => a.day_of_week === day);
                  const isMyDay = dayAssignments.some(
                    (a) => a.household_members?.first_name === userFirstName
                  );

                  return (
                    <tr
                      key={day}
                      className={`border-b border-gray-100 dark:border-slate-800 last:border-0 ${isMyDay ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white w-32">
                        {day}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {dayAssignments.length === 0 ? (
                            <span className="text-gray-400 text-sm">—</span>
                          ) : (
                            dayAssignments.map((a) => (
                              <span
                                key={a.id}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  a.household_members?.first_name === userFirstName
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {a.household_members?.first_name} Bhai
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ── ADMIN VIEW ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-28">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Laundry</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Member tiles to drag */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Drag members to assign days
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                draggable
                onDragStart={() => handleDragStart(member.id)}
                className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:bg-blue-200 dark:hover:bg-blue-900/50"
              >
                {member.first_name} Bhai
              </div>
            ))}
          </div>
        </div>

        {/* Days schedule */}
        <div className="space-y-2">
          {DAYS.map((day) => {
            const dayAssignments = assignments.filter((a) => a.day_of_week === day);
            const isOver = dragOverDay === day;

            return (
              <div
                key={day}
                onDragOver={(e) => handleDragOver(e, day)}
                onDrop={(e) => handleDrop(e, day)}
                onDragLeave={handleDragLeave}
                className={`rounded-xl border-2 transition-all p-4 ${
                  isOver
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white w-24 shrink-0">
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {dayAssignments.length === 0 ? (
                      <span className="text-gray-400 dark:text-gray-600 text-sm">
                        {isOver ? 'Drop here' : 'No one assigned'}
                      </span>
                    ) : (
                      dayAssignments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-lg text-sm font-medium"
                        >
                          {a.household_members?.first_name} Bhai
                          <button
                            onClick={() => handleRemove(a.id)}
                            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))
                    )}
                    {isOver && dayAssignments.length > 0 && (
                      <span className="text-blue-400 text-sm">+ Drop here</span>
                    )}
                  </div>
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