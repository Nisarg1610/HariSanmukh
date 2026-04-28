'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Check, Copy, Trash2, RotateCcw, Bell, Edit2, Lock, Unlock, ChevronLeft, X, Car } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import {
  getSevas, getSevaAssignments, getPendingSevas,
  createSeva, updateSeva, deleteSeva,
  markSevaComplete, refreshSevaAssignments, toggleSevaLock,
  reassignSevaMember,
} from '@/utils/seva';
import { getHouseholdMembers } from '@/utils/members';
import { sendSevaNotification } from '@/utils/pushNotifications';
import { useRouter } from 'next/navigation';

export default function SevaPage() {
  const router = useRouter();
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
  const [togglingLockId, setTogglingLockId] = useState<string | null>(null);

  // Manual Reassignment state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  // ── Quota calculation ──────────────────────────────────────────────────────
  const totalCapUsed = sevas
    .filter((s) => s.id !== editingId)
    .reduce((sum, s) => sum + (s.cap || 0), 0);

  const activeMembers = members.filter((m: any) => m.status === 'active');
  const activeMembersCount = activeMembers.length;
  const maxAllowedCap = Math.max(0, activeMembersCount - totalCapUsed);

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
    lines.push('Update it on HariPrabodham app after you do your seva 🙏 https://brampton-youths.vercel.app/');
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

  const handleSubmitForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Seva name is required'); return; }

    if (form.cap > maxAllowedCap) {
      setError(`Only ${maxAllowedCap} member slots available.`);
      return;
    }

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

  const handleQuickAddPickup = async () => {
    const hasPickup = sevas.some(s => s.name.toLowerCase().includes('pick'));
    if (hasPickup) {
      alert('"Pick up & Drop" seva already exists.');
      return;
    }
    const cap = Math.min(1, maxAllowedCap);
    setFormLoading(true);
    await createSeva(householdId, 'Pick up & Drop', 'Taking members to/from Sabha', cap);
    await fetchAll(householdId);
    setFormLoading(false);
  };

  const handleDelete = async (sevaId: string) => {
    if (!window.confirm('Delete this seva?')) return;
    await deleteSeva(sevaId);
    await fetchAll(householdId);
  };

  const handleRefresh = async () => {
    if (!window.confirm('This will reassign all unlocked sevas. Continue?')) return;
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

  const handleToggleLock = async (assignmentId: string, currentLocked: boolean) => {
    try {
      setTogglingLockId(assignmentId);
      await toggleSevaLock(assignmentId, !currentLocked);
      await fetchAll(householdId);
    } finally {
      setTogglingLockId(null);
    }
  };

  const handleReassignMember = async (newMemberId: string) => {
    if (!selectedAssignmentId) return;
    try {
      setReassigning(true);
      await reassignSevaMember(selectedAssignmentId, newMemberId);
      await fetchAll(householdId);
      setShowReassignModal(false);
      setSelectedAssignmentId(null);
    } catch {
      setError('Failed to reassign member');
    } finally {
      setReassigning(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-12 h-12 rounded-2xl overflow-hidden animate-pulse">
          <img src="/icon-256.png" alt="HariPrabodham" className="w-full h-full object-cover" />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading...</p>
      </main>
    );
  }

  // ─── USER VIEW ──────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)' }}>
        <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
            <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}>
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Seva Section</h1>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
          <section className="rounded-3xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(140deg, #7c3aed 0%, #a855f7 100%)' }}>
            <p className="text-xl font-extrabold">Seva Section</p>
            <p className="text-sm font-medium text-white/85 mt-1">Track and complete your assigned seva.</p>
          </section>

          <div className="card rounded-[24px] border border-[var(--separator)] overflow-hidden shadow-sm bg-[var(--bg-card)]">
            {sevas.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm opacity-50">No sevas found.</p>
              </div>
            ) : (
              sevas.map((seva, idx) => {
                const sevaAssignments = assignments.filter((a) => a.seva_id === seva.id);
                const myAssignment = sevaAssignments.find((a) => a.member_id === memberId);
                const isAssignedToMe = !!myAssignment;
                const isDone = myAssignment?.is_completed;

                return (
                  <div key={seva.id} className="p-4 transition-all" style={{ borderBottom: idx !== sevas.length - 1 ? '1px solid var(--separator)' : 'none', backgroundColor: isAssignedToMe && !isDone ? 'var(--green-bg)' : isDone ? 'rgba(0,0,0,0.02)' : 'transparent', opacity: (!isAssignedToMe) ? 0.6 : 1 }}>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-[15px] font-extrabold" style={{ color: isAssignedToMe && !isDone ? '#1A6340' : 'var(--text-1)', textDecoration: isDone ? 'line-through' : 'none' }}>{seva.name}</h3>
                          {seva.description && <p className="text-[12px] opacity-80" style={{ color: isAssignedToMe && !isDone ? '#1A6340' : 'var(--text-3)' }}>{seva.description}</p>}
                        </div>
                        {myAssignment && !isDone && (
                          <button onClick={() => handleMarkDone(myAssignment.id)} disabled={completingId === myAssignment.id} className="text-[11px] font-extrabold px-3 py-2 rounded-xl shadow-md" style={{ background: 'linear-gradient(135deg, var(--green), #248256)', color: 'white' }}>
                            {completingId === myAssignment.id ? '...' : 'Complete ✓'}
                          </button>
                        )}
                        {isDone && <span className="text-lg" style={{ color: 'var(--green)' }}>✓</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {sevaAssignments.map((a) => (
                          <span key={a.id} className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold shadow-sm" style={{ backgroundColor: a.member_id === memberId ? 'var(--accent)' : 'var(--bg-card-2)', color: a.member_id === memberId ? 'var(--bg)' : 'var(--text-2)', border: a.member_id !== memberId ? '1px solid var(--separator)' : 'none' }}>
                            {a.household_members?.first_name} Bhai {a.is_completed && '✓'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ─── ADMIN VIEW ─────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Seva Section</h1>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-8">
        <section className="rounded-3xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(140deg, #7c3aed 0%, #a855f7 100%)' }}>
          <p className="text-xl font-extrabold">Seva Section</p>
          <p className="text-sm font-medium text-white/85 mt-1">Manage assignments and manual overrides.</p>
        </section>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button onClick={handleCopySevaList} className="p-2.5 rounded-xl transition-all" style={{ color: copied ? 'var(--green)' : 'var(--text-3)', backgroundColor: copied ? 'var(--green-bg)' : 'transparent' }}>
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
            <button onClick={handleNotify} disabled={notifying} className="p-2.5 rounded-xl" style={{ color: 'var(--text-3)' }}><Bell size={20} /></button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2.5 rounded-xl" style={{ color: 'var(--text-3)' }}><RotateCcw size={20} className={refreshing ? 'animate-spin' : ''} /></button>
          </div>
          {/* Quick Add Pick & Drop if missing */}
          {!sevas.some(s => s.name.toLowerCase().includes('pick')) && (
            <button
              onClick={handleQuickAddPickup}
              disabled={formLoading || maxAllowedCap === 0}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-[var(--yellow-bg)] text-[var(--yellow)] border border-[var(--yellow)] transition-transform active:scale-95 disabled:opacity-50"
            >
              <Car size={14} /> + Pick up & Drop
            </button>
          )}
        </div>

        {error && <div className="p-4 rounded-xl bg-[var(--red-bg)] text-[var(--red)] border border-[var(--red)] text-sm">{error}</div>}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header">Current Assignments</h2>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Tap name to reassign</p>
          </div>
          <div className="list-group shadow-sm">
            {sevas.length === 0 ? (
              <p className="text-sm p-8 text-center opacity-40">No sevas yet.</p>
            ) : (
              sevas.map((seva, idx) => {
                const sa = assignments.filter((a) => a.seva_id === seva.id);
                return (
                  <div key={seva.id} className="list-row" style={{ borderBottom: idx !== sevas.length - 1 ? '0.5px solid var(--separator)' : 'none', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-bold text-[14px] mb-2" style={{ color: 'var(--text-1)' }}>{seva.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sa.map((a) => (
                          <div key={a.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: a.is_locked ? 'var(--yellow-bg)' : a.is_completed ? 'var(--green-bg)' : 'var(--accent-bg)', color: a.is_locked ? 'var(--yellow)' : a.is_completed ? 'var(--green)' : 'var(--accent-text)', border: a.is_locked ? '1px solid var(--yellow)' : 'none' }}>
                            {a.is_locked && <Lock size={10} />}
                            <span onClick={() => { setSelectedAssignmentId(a.id); setShowReassignModal(true); }} className="cursor-pointer hover:underline">{a.household_members?.first_name} Bhai {a.is_completed && '✓'}</span>
                            <button onClick={() => handleToggleLock(a.id, a.is_locked)} disabled={togglingLockId === a.id} className="ml-1 p-0.5 rounded-full bg-white/20">{togglingLockId === a.id ? '...' : a.is_locked ? <Unlock size={10} /> : <Lock size={10} />}</button>
                          </div>
                        ))}
                        {sa.length < seva.cap && (
                          <span className="text-[10px] font-bold opacity-30 italic self-center">({seva.cap - sa.length} open slots)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 mt-6">
            <h2 className="section-header">Seva Directory</h2>
            {!showForm && <button onClick={() => { setEditingId(null); setForm({ name: '', description: '', cap: 1 }); setShowForm(true); }} className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold shadow-md active:scale-95"><Plus size={14} /> New Seva</button>}
          </div>

          {showForm && (
            <div className="card p-6 mb-6 border border-[var(--separator)] bg-[var(--bg-card)] shadow-xl animate-in fade-in zoom-in duration-200">
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase opacity-50 mb-1 block">Name</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kitchen Cleaning" className="input" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase opacity-50 mb-1 block">Description</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What needs to be done?" className="input" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold uppercase opacity-50 mb-1 block">Cap (Members)</label>
                    <input type="number" value={form.cap} onChange={e => setForm({ ...form, cap: parseInt(e.target.value) || 0 })} className="input" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={formLoading} className="btn-primary flex-1 shadow-lg">{formLoading ? 'Saving...' : 'Save Seva'}</button>
                </div>
              </form>
            </div>
          )}

          <div className="list-group shadow-sm">
            {sevas.map((seva, idx) => (
              <div key={seva.id} className="list-row" style={{ borderBottom: idx !== sevas.length - 1 ? '1px solid var(--separator)' : 'none' }}>
                <div className="flex-1">
                  <p className="font-bold text-[14px]">{seva.name}</p>
                  <p className="text-[11px] opacity-50 font-bold uppercase mt-0.5">Capacity: {seva.cap} Members</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(seva.id); setForm({ name: seva.name, description: seva.description || '', cap: seva.cap }); setShowForm(true); }} className="p-2.5 rounded-xl bg-[var(--bg-card-2)] border border-[var(--separator)] active:scale-90"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(seva.id)} className="p-2.5 rounded-xl bg-[var(--red-bg)] text-[var(--red)] border border-transparent active:scale-90"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {showReassignModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/70 backdrop-blur-sm transition-all animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-extrabold">Change Member</h3>
                  <p className="text-[11px] font-bold opacity-40 uppercase tracking-widest mt-1">Select a new Bhai for this slot</p>
                </div>
                <button onClick={() => { setShowReassignModal(false); setSelectedAssignmentId(null); }} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-card-2)] active:scale-90 transition-transform"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {activeMembers.map((member) => (
                  <button key={member.id} onClick={() => handleReassignMember(member.id)} disabled={reassigning} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-[var(--separator)] bg-[var(--bg-card-2)] hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] transition-all active:scale-95 disabled:opacity-50">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[var(--accent)] text-white font-bold text-lg shadow-sm">{member.first_name.charAt(0)}</div>
                    <span className="text-[12px] font-bold truncate w-full text-center">{member.first_name}</span>
                  </button>
                ))}
              </div>
              {reassigning && <p className="text-center text-[11px] font-bold mt-4 animate-pulse" style={{ color: 'var(--accent)' }}>Updating assignment...</p>}
            </div>
          </div>
        )}
      </div>
      <BottomNav isAdmin={true} />
    </main>
  );
}