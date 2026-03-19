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
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { window.location.href = '/'; return; }

        const { data: dbUser } = await supabase
          .from('users').select('*').eq('id', authUser.id).single();
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

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  // ─── USER VIEW ───────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Seva</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {sevas.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">No sevas yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Seva</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Assigned To</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sevas.map((seva) => {
                    const sevaAssignments = assignments.filter((a) => a.seva_id === seva.id);
                    const myAssignment = sevaAssignments.find(
                      (a) => a.household_members?.first_name === userFirstName
                    );

                    return (
                      <tr key={seva.id} className={`border-b border-gray-100 dark:border-slate-800 last:border-0 ${myAssignment ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900 dark:text-white">{seva.name}</p>
                          {seva.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{seva.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {sevaAssignments.length === 0 ? (
                              <span className="text-gray-400 text-sm">—</span>
                            ) : (
                              sevaAssignments.map((a) => (
                                <span
                                  key={a.id}
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    a.household_members?.first_name === userFirstName
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {a.household_members?.first_name} Bhai
                                  {a.is_completed && ' ✓'}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {myAssignment && !myAssignment.is_completed ? (
                            <button
                              onClick={() => handleMarkDone(myAssignment.id)}
                              disabled={completingId === myAssignment.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                            >
                              {completingId === myAssignment.id ? '...' : 'Mark Done'}
                            </button>
                          ) : myAssignment?.is_completed ? (
                            <span className="text-green-600 dark:text-green-400 font-bold text-lg">✓</span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ─── ADMIN VIEW ──────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Seva</h1>
          <div className="flex gap-1">
            <button
              onClick={async () => {
    const result = await sendSevaNotification(householdId);
    alert(`Notification sent to ${result.sent} members!`);
  }}
  className="p-2 text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
  title="Notify members"
>
              <Bell size={22} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
              title="Reassign sevas"
            >
              <RotateCcw size={22} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Section 1: Current Assignments */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Current Assignments</h2>
          {sevas.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No sevas created yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Seva</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Assigned To</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sevas.map((seva) => {
                    const sa = assignments.filter((a) => a.seva_id === seva.id);
                    const allDone = sa.length > 0 && sa.every((a) => a.is_completed);
                    const someDone = sa.some((a) => a.is_completed);

                    return (
                      <tr key={seva.id} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{seva.name}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {sa.length === 0 ? (
                              <span className="text-gray-400 text-sm">—</span>
                            ) : (
                              sa.map((a) => (
                                <span key={a.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.is_completed ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'}`}>
                                  {a.household_members?.first_name} Bhai{a.is_completed && ' ✓'}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-sm font-semibold">
                          {allDone ? (
                            <span className="text-green-600 dark:text-green-400">✓ All done</span>
                          ) : someDone ? (
                            <span className="text-yellow-600 dark:text-yellow-400">Partial</span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 2: Manage Sevas */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Sevas</h2>
            {!showForm && (
              <button
                onClick={() => { setEditingId(null); setForm({ name: '', description: '', cap: 1 }); setShowForm(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} /> Add Seva
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                {editingId ? 'Edit Seva' : 'New Seva'}
              </h3>
              <form onSubmit={handleSubmitForm} className="space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seva name (e.g. Hall Cleaning)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Cap (max members) — {members.length} active members
                  </label>
                  <input
                    type="number"
                    value={form.cap}
                    onChange={(e) => setForm({ ...form, cap: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={members.length || 0}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={formLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                    {formLoading ? 'Saving...' : editingId ? 'Update' : 'Create Seva'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', description: '', cap: 0 }); }} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {sevas.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No sevas yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Description</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Cap</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sevas.map((seva) => (
                    <tr key={seva.id} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{seva.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{seva.description || '—'}</td>
                      <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{seva.cap}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => { setEditingId(seva.id); setForm({ name: seva.name, description: seva.description || '', cap: seva.cap }); setShowForm(true); }}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(seva.id)}
                            className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 3: Pending Sevas */}
        {pendingSevas.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Pending Sevas</h2>
            <div className="space-y-2">
              {pendingSevas.map((a) => (
                <div key={a.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-yellow-900 dark:text-yellow-200 text-sm">
                    <span className="font-semibold">{a.household_members?.first_name} Bhai</span>
                    {' → '}
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