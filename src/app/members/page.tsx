'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import {
  getHouseholdMembers,
  addMember,
  updateMember,
  toggleMemberStatus,
  deleteMember,
} from '@/utils/members';

import { AppHeader } from '@/components/AppHeader';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: 'active' | 'inactive';
  role: 'admin' | 'user';
  created_at: string;
}

export default function MembersPage() {
  const [householdId, setHouseholdId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', email: '' });
  const [addingMember, setAddingMember] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', email: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);

const handleToggleRole = async (member: Member) => {
  try {
    setError(null);

    if (!member.email) {
      setError('Member must have an email to be assigned a role.');
      return;
    }

    if (member.role === 'admin') {
      const adminCount = members.filter((m) => m.role === 'admin').length;
      if (adminCount <= 1) {
        setError('Cannot downgrade the last admin.');
        return;
      }
    }

    setTogglingRoleId(member.id);
    const newRole = member.role === 'admin' ? 'user' : 'admin';

    const { error: roleError, data: updatedUsers } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('email', member.email.toLowerCase())
      .select();

    if (roleError) {
      setError('Failed to update role.');
    } else if (updatedUsers && updatedUsers.length === 0) {
      setError('Cannot assign role. User has not signed up yet.');
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );
    }
  } catch (err) {
    setError('Failed to update role.');
  } finally {
    setTogglingRoleId(null);
  }
};
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          window.location.href = '/';
          return;
        }

        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!dbUser || dbUser.role !== 'admin') {
          window.location.href = '/';
          return;
        }

        setHouseholdId(dbUser.household_id);
        const list = await getHouseholdMembers(dbUser.household_id);
        setMembers(list);
      } catch (err) {
        console.error(err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!addForm.firstName.trim() || !addForm.email.trim()) {
      setError('Please enter first name and email');
      return;
    }
    try {
      setAddingMember(true);
      const newMember = await addMember(householdId, addForm.firstName.trim(), addForm.email.trim());
      if (newMember) {
        setMembers((prev) => [...prev, newMember]);
        setAddForm({ firstName: '', email: '' });
        setShowAddForm(false);
      } else {
        setError('Failed to add member');
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingId(member.id);
    setEditForm({ firstName: member.first_name, email: member.email ?? '' });
  };

  const handleSaveEdit = async (memberId: string) => {
    setError(null);
    if (!editForm.firstName.trim()) {
      setError('Please enter first name');
      return;
    }
    try {
      setSavingEdit(true);
      const updated = await updateMember(memberId, editForm.firstName.trim(), editForm.email.trim());
      if (updated) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, ...updated } : m))
        );
        setEditingId(null);
      } else {
        setError('Failed to update member');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggle = async (member: Member) => {
    try {
      setTogglingId(member.id);
      const updated = await toggleMemberStatus(member.id, member.status);
      if (updated) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, status: updated.status } : m))
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!window.confirm('Delete this member? This cannot be undone.')) return;
    try {
      setDeletingId(memberId);
      const ok = await deleteMember(memberId);
      if (ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } else {
        setError('Failed to delete member');
      }
    } finally {
      setDeletingId(null);
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

  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
  <main
    className="min-h-screen pb-28"
    style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
  >
    
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header + Stats */}
      <div>
        <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>Members</h1>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--accent-bg)',
              border: '0.5px solid var(--border-color)',
            }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>Total</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{members.length}</p>
          </div>
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--green-bg)',
              border: '0.5px solid var(--border-color)',
            }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>Active</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--green)' }}>{activeCount}</p>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--red-bg)', border: '0.5px solid var(--red)' }}
        >
          <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Add form / button */}
      {showAddForm ? (
        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '0.5px solid var(--border-color)',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-1)' }}>
            Add New Member
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--text-3)' }}
              >
                First Name
              </label>
              <input
                type="text"
                value={addForm.firstName}
                onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                placeholder="e.g. Nisarg"
                className="input"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--text-3)' }}
              >
                Email
              </label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="e.g. nisarg@email.com"
                className="input"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={addingMember}
                className="btn-primary flex-1 py-2.5 disabled:opacity-50"
              >
                {addingMember ? 'Adding...' : 'Add Member'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddForm({ firstName: '', email: '' }); setError(null); }}
                className="btn-secondary flex-1 py-2.5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center justify-center gap-2 py-3"
        >
          <Plus size={20} />
          Add Member
        </button>
      )}

      {/* Members list */}
      <div className="list-group">
        {members.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-3)' }}>
            No members yet. Add one to get started!
          </p>
        ) : (
          members.map((member, idx) => (
            <div
              key={member.id}
              style={{
                borderBottom: idx !== members.length - 1
                  ? '0.5px solid var(--separator)'
                  : 'none',
                opacity: member.status === 'inactive' ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {editingId === member.id ? (
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    placeholder="First name"
                    className="input text-sm"
                  />
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="Email"
                    className="input text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(member.id)}
                      disabled={savingEdit}
                      className="flex-1 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1 transition-all"
                      style={{ backgroundColor: 'var(--green)' }}
                    >
                      <Check size={15} />
                      {savingEdit ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setError(null); }}
                      className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-1"
                    >
                      <X size={15} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="list-row" style={{ justifyContent: 'space-between' }}>
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent-bg)' }}
                  >
                    <span className="font-bold text-sm" style={{ color: 'var(--accent-text)' }}>
                      {member.first_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                      {member.first_name} Bhai
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                      {member.email ?? 'No email'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-2 rounded-lg transition-all"
                      style={{ color: 'var(--text-3)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-bg)';
                        e.currentTarget.style.color = 'var(--accent)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-3)';
                      }}
                    >
                      <Edit2 size={17} />
                    </button>
 <button
    onClick={() => handleToggleRole(member)}
    disabled={togglingRoleId === member.id}
    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
    style={{
      backgroundColor: member.role === 'admin'
        ? 'var(--accent-bg)'
        : 'var(--bg-card-2)',
      color: member.role === 'admin'
        ? 'var(--accent)'
        : 'var(--text-3)',
    }}
  >
    {togglingRoleId === member.id
      ? '...'
      : member.role === 'admin'
      ? 'Admin'
      : 'User'}
  </button>
                    <button
                      onClick={() => handleToggle(member)}
                      disabled={togglingId === member.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: member.status === 'active'
                          ? 'var(--green-bg)'
                          : 'var(--bg-card-2)',
                        color: member.status === 'active'
                          ? 'var(--green)'
                          : 'var(--text-3)',
                      }}
                    >
                      {togglingId === member.id
                        ? '...'
                        : member.status === 'active'
                        ? 'Active'
                        : 'Inactive'}
                    </button>
                    

                    <button
                      onClick={() => handleDelete(member.id)}
                      disabled={deletingId === member.id}
                      className="p-2 rounded-lg transition-all disabled:opacity-50"
                      style={{ color: 'var(--text-4)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'var(--red-bg)';
                        e.currentTarget.style.color = 'var(--red)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-4)';
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
    <BottomNav isAdmin={true} />
  </main>
);
}