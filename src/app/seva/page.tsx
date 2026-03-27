'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Plus, Check, Copy, Trash2, RotateCcw, Bell, Edit2 } from 'lucide-react';
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
const [copied, setCopied] = useState(false);
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

  const handleCopySevaList = () => {
  if (sevas.length === 0) return;

  const lines: string[] = [];
  lines.push('🏠 HOUSE CLEANING LIST 🏠');
  lines.push('📍 List of seva and who will do it');
  lines.push('');

  sevas.forEach(seva => {
    const sa = assignments.filter(a => a.seva_id === seva.id && !a.is_completed);
    if (sa.length === 0) return;
    const names = sa.map(a => `${a.household_members?.first_name} Bhai`).join(', ');
    lines.push(`• ${seva.name} — ${names}`);
  });

  lines.push('');
  lines.push('Bhaio please ensure these are completed in a timely manner.');
  lines.push('Update it on HariSanmukh app after you do your seva 🙏 https://hari-sanmukh.vercel.app/');

  navigator.clipboard.writeText(lines.join('\n'));
  navigator.clipboard.writeText(lines.join('\n'));
setCopied(true);
setTimeout(() => setCopied(false), 2000);
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
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--green-bg)' }}>
            <span className="text-2xl">🙏</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>My Seva</h1>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-3)' }}>Your tasks for the ghar mandir</p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-[20px] shadow-sm flex gap-3 items-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
            <span className="text-xl">⚠️</span>
            <p className="text-[13px] font-bold text-red-600">{error}</p>
          </div>
        )}

        {sevas.length === 0 ? (
          <div className="card rounded-[24px] p-10 text-center border border-[var(--separator)] shadow-sm mt-4">
            <span className="text-5xl block mb-4 opacity-50">✨</span>
            <p className="text-[16px] font-bold" style={{ color: 'var(--text-2)' }}>No Sevas Assigned</p>
            <p className="text-[13px] mt-2" style={{ color: 'var(--text-4)' }}>You don't have any seva assignments right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sevas.map((seva, idx) => {
              const sevaAssignments = assignments.filter((a) => a.seva_id === seva.id);
              const myAssignment = sevaAssignments.find((a) => a.member_id === memberId);
              const isAssignedToMe = !!myAssignment;
              const isDoneProps = myAssignment?.is_completed;

              return (
                <div
                  key={seva.id}
                  className="card rounded-[24px] overflow-hidden transition-all duration-300"
                  style={{
                    backgroundColor: isAssignedToMe && !isDoneProps ? 'var(--green-bg)' : isDoneProps ? 'rgba(0,0,0,0.02)' : 'var(--bg-card)',
                    border: isAssignedToMe && !isDoneProps ? '2px solid rgba(45, 158, 107, 0.4)' : isDoneProps ? '1px dashed var(--separator)' : '1px solid var(--separator)',
                    opacity: (!isAssignedToMe && userRole === 'user') ? 0.6 : 1,
                    boxShadow: isAssignedToMe && !isDoneProps ? '0 8px 24px -6px rgba(45, 158, 107, 0.2)' : 'none'
                  }}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[16px] font-extrabold" style={{ color: isAssignedToMe && !isDoneProps ? '#1A6340' : 'var(--text-1)', textDecoration: isDoneProps ? 'line-through' : 'none', opacity: isDoneProps ? 0.5 : 1 }}>
                            {seva.name}
                          </h3>
                          {isAssignedToMe && !isDoneProps && (
                            <span className="flex h-2.5 w-2.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                          )}
                        </div>
                        {seva.description && (
                          <p className="text-[12px] font-medium leading-snug mb-3 opacity-80" style={{ color: isAssignedToMe && !isDoneProps ? '#1A6340' : 'var(--text-3)' }}>
                            {seva.description}
                          </p>
                        )}
                      </div>
                      
                      {myAssignment && !isDoneProps && (
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => handleMarkDone(myAssignment.id)}
                            disabled={completingId === myAssignment.id}
                            className="text-[12px] font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 disabled:scale-100"
                            style={{ background: 'linear-gradient(135deg, var(--green), #248256)', color: 'white' }}
                          >
                            {completingId === myAssignment.id ? '...' : 'Complete ✓'}
                          </button>
                        </div>
                      )}
                      
                      {isDoneProps && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-card)] border border-[var(--separator)] shadow-sm">
                          <span className="text-lg" style={{ color: 'var(--green)' }}>✓</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-[var(--separator)] border-opacity-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: isAssignedToMe && !isDoneProps ? 'rgba(26, 99, 64, 0.6)' : 'var(--text-4)' }}>Assigned To</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sevaAssignments.length === 0 ? (
                          <span className="text-[12px] italic text-[var(--text-4)]">Not assigned</span>
                        ) : (
                          sevaAssignments.map((a) => (
                            <span
                              key={a.id}
                              className="px-2.5 py-1 rounded-[8px] text-[11px] font-bold shadow-sm"
                              style={{
                                backgroundColor: a.member_id === memberId ? 'var(--accent)' : 'var(--bg-card-2)',
                                color: a.member_id === memberId ? 'white' : 'var(--text-2)',
                                border: a.member_id !== memberId ? '1px solid var(--separator)' : 'none',
                                opacity: a.is_completed && a.member_id !== memberId ? 0.5 : 1
                              }}
                            >
                              {a.household_members?.first_name} Bhai
                              {a.is_completed && ' ✓'}
                            </span>
                          ))
                        )}
                      </div>
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
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
  onClick={handleCopySevaList}
  className="p-2.5 rounded-xl transition-all"
  style={{
    color: copied ? 'var(--green)' : 'var(--text-3)',
    backgroundColor: copied ? 'var(--green-bg)' : 'transparent',
  }}
  title={copied ? 'Copied!' : 'Copy seva list'}
  onMouseEnter={e => {
    if (!copied) e.currentTarget.style.backgroundColor = 'var(--green-bg)';
  }}
  onMouseLeave={e => {
    if (!copied) e.currentTarget.style.backgroundColor = 'transparent';
  }}
>
  {copied ? <Check size={20} /> : <Copy size={20} />}
</button>
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

      {/* Pending Sevas */}
      {pendingSevas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--yellow)' }} />
            <h2 className="text-[15px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Pending Rollcall</h2>
          </div>
          <div className="card rounded-[24px] p-2 border border-[var(--separator)] bg-[var(--bg-card)] shadow-sm">
            {pendingSevas.map((a, idx) => (
              <div
                key={a.id}
                className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: idx !== pendingSevas.length - 1 ? '1px solid var(--separator)' : 'none' }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--yellow-bg)] flex-shrink-0 shadow-inner">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--yellow)] animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold truncate" style={{ color: 'var(--text-1)' }}>
                    {a.household_members?.first_name} Bhai
                  </p>
                  <p className="text-[12px] font-bold truncate mt-0.5 opacity-80" style={{ color: 'var(--text-3)' }}>
                    {a.sevas?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manage Sevas */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--text-4)' }} />
            <h2 className="text-[15px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Seva Directory</h2>
          </div>
          {!showForm && (
            <button
              onClick={() => { setEditingId(null); setForm({ name: '', description: '', cap: 0 }); setShowForm(true); }}
              className="flex items-center gap-1.5 text-[12px] font-extrabold px-3.5 py-2 rounded-xl shadow-sm transition-transform active:scale-95 text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} /> New
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="card rounded-[24px] p-6 mb-4 border border-[var(--separator)] shadow-md bg-[var(--bg-card)]">
            <h3 className="font-extrabold text-[15px] mb-5 uppercase tracking-wider text-center" style={{ color: 'var(--text-1)' }}>
              {editingId ? 'Edit Seva' : 'Create New Seva'}
            </h3>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seva name (e.g. Hall Cleaning)"
                  className="w-full bg-[var(--bg-card-2)] border border-[var(--separator)] rounded-[14px] px-4 py-3.5 text-[14px] font-semibold outline-none focus:border-[var(--accent)] transition-colors"
                  style={{ color: 'var(--text-1)' }}
                />
              </div>
              <div>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full bg-[var(--bg-card-2)] border border-[var(--separator)] rounded-[14px] px-4 py-3.5 text-[14px] font-medium outline-none focus:border-[var(--accent)] transition-colors"
                  style={{ color: 'var(--text-1)' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-2 uppercase tracking-wide px-1" style={{ color: 'var(--text-3)' }}>
                  Max members ({members.length} total)
                </label>
                <input
                  type="number"
                  value={form.cap}
                  onChange={(e) => setForm({ ...form, cap: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={members.length || 0}
                  className="w-full bg-[var(--bg-card-2)] border border-[var(--separator)] rounded-[14px] px-4 py-3.5 text-[14px] font-semibold outline-none focus:border-[var(--accent)] transition-colors"
                  style={{ color: 'var(--text-1)' }}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', description: '', cap: 0 }); }}
                  className="flex-1 py-3.5 rounded-[14px] text-[13px] font-bold bg-[var(--bg-card-2)] hover:bg-black/5 transition-colors border border-[var(--separator)]"
                  style={{ color: 'var(--text-2)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3.5 rounded-[14px] text-[13px] font-extrabold text-white shadow-md disabled:opacity-50 transition-transform active:scale-95"
                  style={{ background: 'var(--accent)' }}
                >
                  {formLoading ? 'Saving...' : editingId ? 'Update' : 'Save Seva'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sevas list */}
        <div className="card rounded-[24px] border border-[var(--separator)] bg-[var(--bg-card)] shadow-sm py-2">
          {sevas.length === 0 ? (
            <p className="text-[14px] font-medium p-8 text-center" style={{ color: 'var(--text-4)' }}>
              No sevas yet.
            </p>
          ) : (
            sevas.map((seva, idx) => (
              <div
                key={seva.id}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-black/5"
                style={{ borderBottom: idx !== sevas.length - 1 ? '1px solid var(--separator)' : 'none' }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
                      {seva.name}
                    </p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-card-2)] border border-[var(--separator)]" style={{ color: 'var(--text-4)' }}>
                      CAP {seva.cap}
                    </span>
                  </div>
                  {seva.description && (
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-3)' }}>
                      {seva.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(seva.id); setForm({ name: seva.name, description: seva.description || '', cap: seva.cap }); setShowForm(true); }}
                    className="p-2.5 rounded-xl transition-colors bg-[var(--bg-card-2)] hover:bg-[var(--accent-bg)] border border-[var(--separator)] hover:border-transparent"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(seva.id)}
                    className="p-2.5 rounded-xl transition-colors bg-[var(--red-bg)] text-[var(--red)] border border-transparent shadow-sm hover:opacity-80"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
    <BottomNav isAdmin={true} />
  </main>
);
}