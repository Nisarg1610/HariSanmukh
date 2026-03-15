'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Plus, Trash2 } from 'lucide-react';
import {
  getHouseholdMembers,
  addMember,
  toggleMemberStatus,
  deleteMember,
} from '@/utils/members';

interface Member {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export default function MembersPage() {
  const [user, setUser] = useState<any>(null);
  const [householdId, setHouseholdId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          window.location.href = '/';
          return;
        }

        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        // Check if user is admin
        if (!dbUser || dbUser.role !== 'admin') {
          window.location.href = '/';
          return;
        }

        setUser(authUser);
        setHouseholdId(dbUser.household_id);

        // Fetch members
        const membersList = await getHouseholdMembers(dbUser.household_id);
        setMembers(membersList);
      } catch (err) {
        console.error('Auth error:', err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter first and last name');
      return;
    }

    try {
      setAddingMember(true);
      const newMember = await addMember(householdId, firstName, lastName);

      if (newMember) {
        setMembers([...members, newMember]);
        setFirstName('');
        setLastName('');
        setShowAddForm(false);
      } else {
        setError('Failed to add member');
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleStatus = async (memberId: string, currentStatus: string) => {
    try {
      setTogglingId(memberId);
      const updated = await toggleMemberStatus(memberId, currentStatus);

      if (updated) {
        setMembers(
          members.map((m) =>
            m.id === memberId ? { ...m, status: updated.status } : m
          )
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to delete this member?')) {
      return;
    }

    try {
      setDeletingId(memberId);
      const success = await deleteMember(memberId);

      if (success) {
        setMembers(members.filter((m) => m.id !== memberId));
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
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Members
          </h1>

          {/* Member Count Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 mb-6">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Total Members
            </h3>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {members.length}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Add Member Form */}
        {showAddForm ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Add New Member
            </h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingMember}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFirstName('');
                    setLastName('');
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={20} />
            Add Member
          </button>
        )}

        {/* Members List */}
        <div className="space-y-3">
          {members.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              No members yet. Add one to get started!
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {member.first_name} {member.last_name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {member.status === 'active' ? '✓ Active' : '⏸ Inactive'}
                  </p>
                </div>

                <div className="flex gap-2">
                  {/* Toggle Status Button */}
                  <button
                    onClick={() =>
                      handleToggleStatus(member.id, member.status)
                    }
                    disabled={togglingId === member.id}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                      member.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    {togglingId === member.id
                      ? 'Updating...'
                      : member.status === 'active'
                      ? 'Active'
                      : 'Inactive'}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    disabled={deletingId === member.id}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                    title="Delete member"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav isAdmin={true} />
    </main>
  );
}