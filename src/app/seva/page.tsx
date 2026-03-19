'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Plus, Trash2, RotateCcw, Bell, Edit2 } from 'lucide-react';
import {
  getSevas, getSevaAssignments, getPendingSevas,
  createSeva, updateSeva, deleteSeva,
  markSevaComplete, refreshSevaAssignments,
} from '@/utils/seva';
import { getHouseholdMembers } from '@/utils/members';
import { sendSevaNotification } from '@/utils/pushNotifications';

export default function SevaPage() {
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userFirstName, setUserFirstName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [sevas, setSevas] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingSevas, setPendingSevas] = useState<any[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', cap: 0 });
  const [formLoading, setFormLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);

  const fetchAll = async (hId: string) => {
    const [s, a, m, p] = await Promise.all([
      getSevas(hId),
      getSevaAssignments(hId),
      getHouseholdMembers(hId),
      getPendingSevas(hId),
    ]);
    setSevas(s);
    setAssignments(a);
    setMembers(m);
    setPendingSevas(p);
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

        // Get member id
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

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Seva name is required'); return; }
    try {
      setFormLoading(true);
      if (editingId) {
        await updateSeva(editingId, form.name, form.description, form.cap);
      } else {
        await createSeva(householdId, form.name, form.description, form.cap);
      }
      await fetchAll(householdId);
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', description: '', cap: 0 });
    } catch {
      setError('Failed to save seva');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (sevaId: string) => {
    if (!window.confirm('Delete this seva?')) return;
    await deleteSeva(sevaId);
    await fetchAll(householdId);
  };

  const handleRefresh = async () => {
    if (!window.confirm('This will reassign all sevas to active members. Continue?')) return;
    try {
      setRefreshing(true);
      await refreshSevaAssignments(householdId);
      await fetchAll(householdId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkDone = async (assignmentId: string) => {
    if (!window.confirm('Mark your seva as done?')) return;
    try {
      setCompletingId(assignmentId);
      await markSevaComplete(assignmentId);
      await fetchAll(householdId);
    } finally {
      setCompletingId(null);
    }
  };

  const handleNotify = async () => {
    try {
      setNotifying(true);
      const result = await sendSevaNotification(householdId);
      alert(`Notification sent to ${result.sent} members!`);
    } finally {
      setNotifying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse">
          <span className="text-white text-xl">🙏</span>
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
      </main>
    );
  }

  // ─── USER VIEW ──────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main
        className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6">

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Seva</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {sevas.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-12 text-center">
              <p className="text-gray-400 dark:text-gray-600 text-sm">No sevas assigned yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <div className="grid grid-cols-3 gap-4">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Seva</span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assigned To</span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">Status</span>
                </div>
              </div>
              {sevas.map((seva, idx) => {
                const sevaAssignments = assignments.filter((a) => a.seva_id === seva.id);
                const myAssignment = sevaAssignments.find(
                  (a) => a.member_id === memberId
                );
                return (
                  <div
                    key={seva.id}
                    className={`px-4 py-4 ${idx !== sevas.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''} ${myAssignment ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{seva.name}</p>
                        {seva.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{seva.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {sevaAssignments.length === 0 ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          sevaAssignments.map((a) => (
                            <span
                              key={a.id}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                a.member_id === memberId
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {a.household_members?.first_name} Bhai
                              {a.is_completed && ' ✓'}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="text-center">
                        {myAssignment && !myAssignment.is_completed ? (
                          <button
                            onClick={() => handleMarkDone(myAssignment.id)}
                            disabled={completingId === myAssignment.id}
                            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                          >
                            {completingId === myAssignment.id ? '...' : 'Mark Done'}
                          </button>
                        ) : myAssignment?.is_completed ? (
                          <span className="text-green-500 font-bold text-lg">✓</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-700">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ─── ADMIN VIEW ──────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Seva</h1>
          <div className="flex gap-1">
            <button
              onClick={handleNotify}
              disabled={notifying}
              className="p-2.5 text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all disabled:opacity-50"
              title="Notify members"
            >
              <Bell size={20} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all disabled:opacity-50"
              title="Reassign sevas"
            >
              <RotateCcw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Current Assignments */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Current Assignments
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
            {sevas.length === 0 ? (
              <p className="text-gray-400 text-sm p-6 text-center">No sevas created yet.</p>
            ) : (
              sevas.map((seva, idx) => {
                const sa = assignments.filter((a) => a.seva_id === seva.id);
                const allDone = sa.length > 0 && sa.every((a) => a.is_completed);
                const someDone = sa.some((a) => a.is_completed);

                return (
                  <div
                    key={seva.id}
                    className={`px-4 py-4 ${idx !== sevas.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm mb-2">{seva.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sa.length === 0 ? (
                            <span className="text-gray-400 text-xs">No one assigned</span>
                          ) : (
                            sa.map((a) => (
                              <span
                                key={a.id}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  a.is_completed
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                }`}
                              >
                                {a.household_members?.first_name} Bhai{a.is_completed && ' ✓'}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {allDone ? (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold px-2.5 py-1 rounded-full">
                            ✓ All done
                          </span>
                        ) : someDone ? (
                          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-semibold px-2.5 py-1 rounded-full">
                            Partial
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 font-semibold px-2.5 py-1 rounded-full">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Manage Sevas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Manage Sevas
            </h2>
            {!showForm && (
              <button
                onClick={() => { setEditingId(null); setForm({ name: '', description: '', cap: 0 }); setShowForm(true); }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              >
                <Plus size={14} /> Add Seva
              </button>
            )}
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm">
                {editingId ? 'Edit Seva' : 'New Seva'}
              </h3>
              <form onSubmit={handleSubmitForm} className="space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seva name (e.g. Hall Cleaning)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    Cap — {members.length} total members
                  </label>
                  <input
                    type="number"
                    value={form.cap}
                    onChange={(e) => setForm({ ...form, cap: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={members.length || 0}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50 text-sm transition-all"
                  >
                    {formLoading ? 'Saving...' : editingId ? 'Update' : 'Create Seva'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', description: '', cap: 0 }); }}
                    className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sevas list */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
            {sevas.length === 0 ? (
              <p className="text-gray-400 text-sm p-6 text-center">No sevas yet. Create one!</p>
            ) : (
              sevas.map((seva, idx) => (
                <div
                  key={seva.id}
                  className={`flex items-center gap-3 px-4 py-4 ${idx !== sevas.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{seva.name}</p>
                    {seva.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{seva.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    Cap: {seva.cap}
                  </span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(seva.id); setForm({ name: seva.name, description: seva.description || '', cap: seva.cap }); setShowForm(true); }}
                      className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(seva.id)}
                      className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Pending Sevas */}
        {pendingSevas.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Pending Sevas
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              {pendingSevas.map((a, idx) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx !== pendingSevas.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                >
                  <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {a.household_members?.first_name} Bhai
                    </span>
                    <span className="text-gray-400 mx-1.5">→</span>
                    {a.sevas?.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
      <BottomNav isAdmin={true} />
    </main>
  );
}