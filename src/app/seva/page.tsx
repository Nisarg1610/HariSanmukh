'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Plus, Trash2, RotateCcw, Bell, Edit2 } from 'lucide-react';
import {
  getSevas,
  getUserSevaAssignments,
  getSevaAssignments,
  createSeva,
  updateSeva,
  deleteSeva,
  markSevaComplete,
  refreshSevaAssignments,
  getPendingSevas,
} from '@/utils/seva';
import { getHouseholdMembers } from '@/utils/members';

interface Seva {
  id: string;
  name: string;
  description?: string;
  cap: number;
}

interface Assignment {
  id: string;
  seva_id: string;
  member_id: string;
  is_completed: boolean;
  sevas?: { id: string; name: string; description?: string; cap: number };
  household_members?: { id: string; name: string };
}

interface Member {
  id: string;
  name: string;
}

export default function SevaPage() {
  const [user, setUser] = useState<any>(null);
  const [householdId, setHouseholdId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('user');
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Admin states
  const [sevas, setSevas] = useState<Seva[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingSevas, setPendingSevas] = useState<Assignment[]>([]);

  // Form states
  const [showAddSevaForm, setShowAddSevaForm] = useState(false);
  const [editingSevaId, setEditingSevaId] = useState<string | null>(null);
  const [sevaForm, setSevaForm] = useState({
    name: '',
    description: '',
    cap: 0,
  });
  const [addingSevaLoading, setAddingSevaLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User states
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);

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

        if (!dbUser) {
          window.location.href = '/';
          return;
        }

        setUser(authUser);
        setHouseholdId(dbUser.household_id);
        setUserRole(dbUser.role);
        setUserName(dbUser.first_name);

        // Fetch data
        const sevasList = await getSevas(dbUser.household_id);
        setSevas(sevasList);

        const assignmentsList = await getSevaAssignments(dbUser.household_id);
        setAssignments(assignmentsList);

        const membersList = await getHouseholdMembers(dbUser.household_id);
        setMembers(membersList);

        const pendingList = await getPendingSevas(dbUser.household_id);
        setPendingSevas(pendingList);

        // User assignments
        if (dbUser.role === 'user') {
          const userAssignmentsList = await getUserSevaAssignments(
            dbUser.household_id,
            dbUser.first_name
          );
          setUserAssignments(userAssignmentsList);
        }
      } catch (err) {
        console.error('Auth error:', err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Admin: Add Seva
  const handleAddSeva = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sevaForm.name.trim()) {
      setError('Please enter seva name');
      return;
    }

    if (sevaForm.cap < 1) {
      setError('Cap must be at least 1');
      return;
    }

    try {
      setAddingSevaLoading(true);

      if (editingSevaId) {
        // Update existing seva
        const updated = await updateSeva(
          editingSevaId,
          sevaForm.name,
          sevaForm.description,
          sevaForm.cap
        );

        if (updated) {
          setSevas(
            sevas.map((s) =>
              s.id === editingSevaId
                ? { ...s, name: updated.name, description: updated.description, cap: updated.cap }
                : s
            )
          );
          setEditingSevaId(null);
        } else {
          setError('Failed to update seva');
        }
      } else {
        // Create new seva
        const newSeva = await createSeva(
          householdId,
          sevaForm.name,
          sevaForm.description,
          sevaForm.cap
        );

        if (newSeva) {
          setSevas([...sevas, newSeva]);
        } else {
          setError('Failed to add seva');
        }
      }

      setSevaForm({ name: '', description: '', cap: 1 });
      setShowAddSevaForm(false);
    } finally {
      setAddingSevaLoading(false);
    }
  };

  // Admin: Edit Seva
  const handleEditSeva = (seva: Seva) => {
    setEditingSevaId(seva.id);
    setSevaForm({
      name: seva.name,
      description: seva.description || '',
      cap: seva.cap,
    });
    setShowAddSevaForm(true);
  };

  // Admin: Delete Seva
  const handleDeleteSeva = async (sevaId: string) => {
    if (!window.confirm('Are you sure you want to delete this seva?')) {
      return;
    }

    try {
      const success = await deleteSeva(sevaId);
      if (success) {
        setSevas(sevas.filter((s) => s.id !== sevaId));
        setAssignments(assignments.filter((a) => a.seva_id !== sevaId));
      } else {
        setError('Failed to delete seva');
      }
    } catch (err) {
      setError('Failed to delete seva');
    }
  };

  // Admin: Refresh Assignments
  const handleRefresh = async () => {
    if (!window.confirm('This will reassign all sevas. Continue?')) {
      return;
    }

    try {
      setRefreshing(true);
      const success = await refreshSevaAssignments(householdId);

      if (success) {
        const assignmentsList = await getSevaAssignments(householdId);
        setAssignments(assignmentsList);
        const pendingList = await getPendingSevas(householdId);
        setPendingSevas(pendingList);
        setError(null);
      } else {
        setError('Failed to refresh assignments');
      }
    } finally {
      setRefreshing(false);
    }
  };

  // User: Mark Seva Complete
  const handleMarkComplete = async (assignmentId: string, sevaId: string, memberId: string) => {
    const confirmed = window.confirm('Is your seva done?');
    if (!confirmed) return;

    try {
      setCompletingId(assignmentId);
      const success = await markSevaComplete(assignmentId, sevaId, memberId);

      if (success) {
        setUserAssignments(
          userAssignments.map((a) =>
            a.id === assignmentId ? { ...a, is_completed: true } : a
          )
        );
        setAssignments(
          assignments.map((a) =>
            a.id === assignmentId ? { ...a, is_completed: true } : a
          )
        );
      } else {
        setError('Failed to mark seva complete');
      }
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  // USER VIEW
  if (userRole === 'user') {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Seva
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Seva List */}
          <div className="space-y-3">
            {userAssignments.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                No sevas assigned yet.
              </p>
            ) : (
              userAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {assignment.sevas?.name}
                      </h3>
                      {assignment.sevas?.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {assignment.sevas.description}
                        </p>
                      )}
                    </div>
                    {assignment.is_completed && (
                      <span className="text-2xl">✓</span>
                    )}
                  </div>

                  {!assignment.is_completed && (
                    <button
                      onClick={() =>
                        handleMarkComplete(
                          assignment.id,
                          assignment.seva_id,
                          assignment.member_id
                        )
                      }
                      disabled={completingId === assignment.id}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                    >
                      {completingId === assignment.id ? 'Completing...' : 'Mark Done'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ADMIN VIEW
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Seva List
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => alert('Notifications coming soon!')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              title="Notifications"
            >
              <Bell size={24} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
              title="Refresh assignments"
            >
              <RotateCcw size={24} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Subsection 1: Seva List */}
        {/* Subsection 1: Seva List */}
<div className="mb-12">
  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
    Current Assignments
  </h2>

  {assignments.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-400">No assignments yet.</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
              Seva Name
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
              Assigned To
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {sevas.map((seva) => {
            // Get all assignments for this seva
            const sevaAssignments = assignments.filter((a) => a.seva_id === seva.id);
            
            return (
              <tr
                key={seva.id}
                className="border-b border-gray-100 dark:border-slate-800"
              >
                <td className="py-3 px-4 text-gray-900 dark:text-white">
                  {seva.name}
                </td>
                <td className="py-3 px-4 text-gray-900 dark:text-white">
                  <div className="flex flex-wrap gap-2">
                    {sevaAssignments.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      sevaAssignments.map((assignment, idx) => (
                        <span
                          key={assignment.id}
                          className={`px-2 py-1 rounded text-sm ${
                            assignment.is_completed
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          }`}
                        >
                          {assignment.household_members?.name}
                          {assignment.is_completed && ' ✓'}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {sevaAssignments.every((a) => a.is_completed) && sevaAssignments.length > 0 ? (
                    <span className="text-green-600 dark:text-green-400 font-semibold">✓ All</span>
                  ) : sevaAssignments.some((a) => a.is_completed) ? (
                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">Partial</span>
                  ) : (
                    <span className="text-gray-400">—</span>
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

        {/* Subsection 2: Manage Sevas */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Manage Sevas
            </h2>
            {!showAddSevaForm && (
              <button
                onClick={() => {
                  setEditingSevaId(null);
                  setSevaForm({ name: '', description: '', cap: 1 });
                  setShowAddSevaForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all"
              >
                <Plus size={20} />
                Add Seva
              </button>
            )}
          </div>

          {/* Add/Edit Seva Form */}
          {showAddSevaForm && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingSevaId ? 'Edit Seva' : 'Create New Seva'}
              </h3>
              <form onSubmit={handleAddSeva} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Seva Name
                  </label>
                  <input
                    type="text"
                    value={sevaForm.name}
                    onChange={(e) =>
                      setSevaForm({ ...sevaForm, name: e.target.value })
                    }
                    placeholder="e.g., Kitchen Cleaning"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={sevaForm.description}
                    onChange={(e) =>
                      setSevaForm({ ...sevaForm, description: e.target.value })
                    }
                    placeholder="Add description"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              <div>
  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
    Cap (Number of Members)
  </label>
  <input
    type="number"
    value={sevaForm.cap}
    onChange={(e) =>
      setSevaForm({
        ...sevaForm,
        cap: parseInt(e.target.value) || 0,
      })
    }
    min="0"
    max={members.length}
    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
    Total members: {members.length}
  </p>
</div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={addingSevaLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                  >
                    {addingSevaLoading ? (editingSevaId ? 'Updating...' : 'Adding...') : (editingSevaId ? 'Update Seva' : 'Add Seva')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSevaForm(false);
                      setEditingSevaId(null);
                      setSevaForm({ name: '', description: '', cap: 1 });
                    }}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sevas List */}
          {sevas.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No sevas yet. Create one to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Seva Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Description
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Cap
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sevas.map((seva) => (
                    <tr
                      key={seva.id}
                      className="border-b border-gray-100 dark:border-slate-800"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white">
                        {seva.name}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                        {seva.description || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white">
                        {seva.cap}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEditSeva(seva)}
                            className="inline-flex p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="Edit seva"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteSeva(seva.id)}
                            className="inline-flex p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Delete seva"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Sevas */}
        {pendingSevas.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Pending Sevas
            </h2>
            <div className="space-y-2">
              {pendingSevas.map((seva) => (
                <div
                  key={seva.id}
                  className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
                >
                  <p className="text-yellow-900 dark:text-yellow-200">
                    <span className="font-semibold">{seva.household_members?.name}</span> - {seva.sevas?.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav isAdmin={true} />
    </main>
  );
}