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
import { AppHeader } from '@/components/AppHeader';

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

  // ─── USER VIEW ──────────────────────────────────────────────
 if (userRole === 'user') {
  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
   
      <div className="max-w-2xl mx-auto px-4 py-6">

        <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--text-1)' }}>Seva Section</h1>

        {error && (
          <div
            className="mb-4 p-4 rounded-xl"
            style={{ backgroundColor: 'var(--red-bg)', border: '0.5px solid var(--red)' }}
          >
            <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
          </div>
        )}

        {sevas.length === 0 ? (
          <div className="list-group p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-4)' }}>No sevas assigned yet</p>
          </div>
        ) : (
          <div className="list-group">
            {/* Header row */}
            <div
              className="px-4 py-3"
              style={{
                borderBottom: '0.5px solid var(--separator)',
                backgroundColor: 'var(--bg-card-2)',
              }}
            >
              <div className="grid grid-cols-3 gap-4">
                <span className="section-header" style={{ marginBottom: 0 }}>Seva</span>
                <span className="section-header" style={{ marginBottom: 0 }}>Assigned To</span>
                <span className="section-header text-center" style={{ marginBottom: 0 }}>Status</span>
              </div>
            </div>

            {sevas.map((seva, idx) => {
              const sevaAssignments = assignments.filter((a) => a.seva_id === seva.id);
              const myAssignment = sevaAssignments.find((a) => a.member_id === memberId);

              return (
                <div
                  key={seva.id}
                  className="px-4 py-4"
                  style={{
                    borderBottom: idx !== sevas.length - 1
                      ? '0.5px solid var(--separator)'
                      : 'none',
                    backgroundColor: myAssignment
                      ? 'var(--accent-bg)'
                      : 'transparent',
                  }}
                >
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Seva name */}
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                        {seva.name}
                      </p>
                      {seva.description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {seva.description}
                        </p>
                      )}
                    </div>

                    {/* Assigned members */}
                    <div className="flex flex-wrap gap-1">
                      {sevaAssignments.length === 0 ? (
                        <span className="text-xs" style={{ color: 'var(--text-4)' }}>—</span>
                      ) : (
                        sevaAssignments.map((a) => (
                          <span
                            key={a.id}
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
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
                            {a.is_completed && ' ✓'}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Status / action */}
                    <div className="text-center">
                      {myAssignment && !myAssignment.is_completed ? (
                        <button
                          onClick={() => handleMarkDone(myAssignment.id)}
                          disabled={completingId === myAssignment.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all text-white"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          {completingId === myAssignment.id ? '...' : 'Mark Done'}
                        </button>
                      ) : myAssignment?.is_completed ? (
                        <span className="font-bold text-lg" style={{ color: 'var(--green)' }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--text-4)' }}>—</span>
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
    className="min-h-screen pb-28"
    style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
  >
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Seva</h1>
        <div className="flex gap-1">
          <button
            onClick={handleNotify}
            disabled={notifying}
            className="p-2.5 rounded-xl transition-all disabled:opacity-50"
            style={{ color: 'var(--text-3)' }}
            title="Notify members"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--yellow-bg)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Bell size={20} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl transition-all disabled:opacity-50"
            style={{ color: 'var(--text-3)' }}
            title="Reassign sevas"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-bg)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <RotateCcw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--red-bg)',
            border: '0.5px solid var(--red)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Current Assignments */}
      <section>
        <h2 className="section-header mb-3">Current Assignments</h2>
        <div className="list-group">
          {sevas.length === 0 ? (
            <p className="text-sm p-6 text-center" style={{ color: 'var(--text-4)' }}>
              No sevas created yet.
            </p>
          ) : (
            sevas.map((seva, idx) => {
              const sa = assignments.filter((a) => a.seva_id === seva.id);
              const allDone = sa.length > 0 && sa.every((a) => a.is_completed);
              const someDone = sa.some((a) => a.is_completed);

              return (
                <div
                  key={seva.id}
                  className="list-row"
                  style={{
                    borderBottom: idx !== sevas.length - 1
                      ? '0.5px solid var(--separator)'
                      : 'none',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-semibold text-sm mb-2" style={{ color: 'var(--text-1)' }}>
                      {seva.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sa.length === 0 ? (
                        <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                          No one assigned
                        </span>
                      ) : (
                        sa.map((a) => (
                          <span
                            key={a.id}
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: a.is_completed ? 'var(--green-bg)' : 'var(--accent-bg)',
                              color: a.is_completed ? 'var(--green)' : 'var(--accent-text)',
                            }}
                          >
                            {a.household_members?.first_name} Bhai{a.is_completed && ' ✓'}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {allDone ? (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--green-bg)', color: 'var(--green)' }}
                      >
                        ✓ All done
                      </span>
                    ) : someDone ? (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--yellow-bg)', color: 'var(--yellow)' }}
                      >
                        Partial
                      </span>
                    ) : (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-3)' }}
                      >
                        Pending
                      </span>
                    )}
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
          <h2 className="section-header">Manage Sevas</h2>
          {!showForm && (
            <button
              onClick={() => { setEditingId(null); setForm({ name: '', description: '', cap: 0 }); setShowForm(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white',
              }}
            >
              <Plus size={14} /> Add Seva
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="list-group p-5 mb-3">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-1)' }}>
              {editingId ? 'Edit Seva' : 'New Seva'}
            </h3>
            <form onSubmit={handleSubmitForm} className="space-y-3">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seva name (e.g. Hall Cleaning)"
                className="input text-sm"
              />
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                className="input text-sm"
              />
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: 'var(--text-3)' }}
                >
                  Cap — {members.length} total members
                </label>
                <input
                  type="number"
                  value={form.cap}
                  onChange={(e) => setForm({ ...form, cap: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={members.length || 0}
                  className="input text-sm"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary py-2.5 text-sm disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editingId ? 'Update' : 'Create Seva'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', description: '', cap: 0 }); }}
                  className="btn-secondary py-2.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sevas list */}
        <div className="list-group">
          {sevas.length === 0 ? (
            <p className="text-sm p-6 text-center" style={{ color: 'var(--text-4)' }}>
              No sevas yet. Create one!
            </p>
          ) : (
            sevas.map((seva, idx) => (
              <div
                key={seva.id}
                className="list-row"
                style={{
                  borderBottom: idx !== sevas.length - 1
                    ? '0.5px solid var(--separator)'
                    : 'none',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                    {seva.name}
                  </p>
                  {seva.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {seva.description}
                    </p>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-4)' }}>
                  Cap: {seva.cap}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(seva.id); setForm({ name: seva.name, description: seva.description || '', cap: seva.cap }); setShowForm(true); }}
                    className="p-2 rounded-lg transition-all"
                    style={{ color: 'var(--accent)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(seva.id)}
                    className="p-2 rounded-lg transition-all"
                    style={{ color: 'var(--red)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--red-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
          <h2 className="section-header mb-3">Pending Sevas</h2>
          <div className="list-group">
            {pendingSevas.map((a, idx) => (
              <div
                key={a.id}
                className="list-row"
                style={{
                  borderBottom: idx !== pendingSevas.length - 1
                    ? '0.5px solid var(--separator)'
                    : 'none',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--yellow)' }}
                />
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-1)' }}>
                    {a.household_members?.first_name} Bhai
                  </span>
                  <span className="mx-1.5" style={{ color: 'var(--text-4)' }}>→</span>
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