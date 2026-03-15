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

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: 'active' | 'inactive';
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
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-28">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Members</h1>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Total</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{members.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Active</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {showAddForm ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add New Member</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                  placeholder="e.g. Nisarg"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="e.g. nisarg@email.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingMember}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-all"
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddForm({ firstName: '', email: '' }); setError(null); }}
                  className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={20} />
            Add Member
          </button>
        )}

        <div className="space-y-3">
          {members.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              No members yet. Add one to get started!
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border transition-all ${
                  member.status === 'inactive'
                    ? 'border-gray-100 dark:border-slate-800 opacity-60'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                {editingId === member.id ? (
                  <div className="p-4 space-y-3">
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      placeholder="First name"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Email"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(member.id)}
                        disabled={savingEdit}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check size={16} />
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setError(null); }}
                        className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">
                        {member.first_name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {member.first_name} Bhai
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {member.email ?? 'No email'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit2 size={17} />
                      </button>

                      <button
                        onClick={() => handleToggle(member)}
                        disabled={togglingId === member.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                          member.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {togglingId === member.id ? '...' : member.status === 'active' ? 'Active' : 'Inactive'}
                      </button>

                      <button
                        onClick={() => handleDelete(member.id)}
                        disabled={deletingId === member.id}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                        title="Delete"
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