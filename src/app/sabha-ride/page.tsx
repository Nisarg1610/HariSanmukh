'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Bell, Check, Info, MessageSquare, User, Car, ThumbsUp, ThumbsDown, Walking } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SabhaRidePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [isEnabled, setIsEnabled] = useState(false);
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  // Reason flow state
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  // Absence reasons for admin
  const [absenceReasons, setAbsenceReasons] = useState<any[]>([]);

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
        setIsAdmin(dbUser.role === 'admin' || dbUser.role === 'superadmin');

        const { data: memberCard } = await supabase
          .from('household_members').select('id')
          .eq('email', session.user.email!).maybeSingle();
        if (memberCard) {
          setMemberId(memberCard.id);
        }

        await loadState(dbUser.household_id, memberCard?.id || null, dbUser.role);
      } catch (err) {
        console.error(err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadState = async (hId: string, mId: string | null, role: string) => {
    try {
      // Check if feature is enabled
      const { data: statusData } = await supabase
        .from('sabha_ride_status')
        .select('*')
        .eq('household_id', hId)
        .maybeSingle();

      setIsEnabled(statusData?.is_enabled ?? false);

      // Fetch user's vote
      if (mId) {
        const { data: myVote } = await supabase
          .from('sabha_ride_votes')
          .select('vote')
          .eq('household_id', hId)
          .eq('member_id', mId)
          .maybeSingle();

        if (myVote) {
          setHasVoted(myVote.vote);
        } else {
          setHasVoted(null);
        }
      }

      // If admin, fetch all votes, members, and absence reasons
      const isUserAdmin = role === 'admin' || role === 'superadmin';
      if (isUserAdmin) {
        const [{ data: votesData }, { data: membersData }] = await Promise.all([
          supabase.from('sabha_ride_votes').select('*').eq('household_id', hId),
          supabase.from('household_members').select('*').eq('household_id', hId)
        ]);
        setVotes(votesData || []);
        setMembers(membersData || []);

        // Fetch absence reasons from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: reasons } = await supabase
          .from('sabha_absence_reasons')
          .select('*')
          .eq('household_id', hId)
          .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
          .order('created_at', { ascending: false });
        setAbsenceReasons(reasons || []);
      }
    } catch (err) {
      console.error('Failed to load Sabha ride state:', err);
    }
  };

  const handleVote = async (choice: string) => {
    if (!memberId || !householdId) return;

    if (choice === 'no') {
      setShowReasonInput(true);
      return;
    }

    try {
      const { error } = await supabase
        .from('sabha_ride_votes')
        .upsert({
          household_id: householdId,
          member_id: memberId,
          vote: choice,
          updated_at: new Date().toISOString()
        }, { onConflict: 'household_id,member_id' });

      if (!error) {
        setHasVoted(choice);
        loadState(householdId, memberId, userRole);
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const handleSubmitNoWithReason = async () => {
    if (!memberId || !householdId || !reasonText.trim()) return;

    try {
      setSubmittingReason(true);

      const { data: memberData } = await supabase
        .from('household_members')
        .select('first_name, last_name, email')
        .eq('id', memberId)
        .maybeSingle();

      const { error: voteError } = await supabase
        .from('sabha_ride_votes')
        .upsert({
          household_id: householdId,
          member_id: memberId,
          vote: 'no',
          updated_at: new Date().toISOString()
        }, { onConflict: 'household_id,member_id' });

      if (voteError) throw voteError;

      const { error: reasonError } = await supabase
        .from('sabha_absence_reasons')
        .insert({
          household_id: householdId,
          member_id: memberId,
          member_name: memberData
            ? `${memberData.first_name} ${memberData.last_name}`
            : 'Unknown',
          member_email: memberData?.email || null,
          reason: reasonText.trim(),
        });

      if (reasonError) throw reasonError;

      setHasVoted('no');
      setShowReasonInput(false);
      setReasonText('');
      loadState(householdId, memberId, userRole);
    } catch (err) {
      console.error('Error submitting reason:', err);
    } finally {
      setSubmittingReason(false);
    }
  };

  const toggleEnabled = async () => {
    const nextState = !isEnabled;
    try {
      if (nextState) {
        await supabase.from('sabha_ride_votes').delete().eq('household_id', householdId);
        setVotes([]);
        setHasVoted(null);
      }

      await supabase
        .from('sabha_ride_status')
        .upsert({
          household_id: householdId,
          is_enabled: nextState,
          updated_at: new Date().toISOString()
        }, { onConflict: 'household_id' });

      setIsEnabled(nextState);
    } catch (err) {
      console.error('Error toggling feature:', err);
    }
  };

  const notifyAll = async () => {
    if (notifying) return;
    setNotifying(true);
    try {
      const res = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: householdId,
          title: 'Upcoming Sabha',
          body: 'Do you need ride for the upcoming Sabha??',
        })
      });
      if (res.ok) {
        setNotified(true);
        setTimeout(() => setNotified(false), 3000);
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
    } finally {
      setNotifying(false);
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

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Sabha Ride</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        <section
          className="rounded-3xl p-5 text-white shadow-sm relative overflow-hidden"
          style={{ background: 'linear-gradient(140deg, #f59e0b 0%, #d97706 100%)' }}
        >
          <div className="relative z-10">
            <p className="text-xl font-extrabold">Sabha Ride</p>
            <p className="text-sm font-medium text-white/85 mt-1">
              Coordinate rides for the upcoming Sabha.
            </p>
          </div>
          <Car size={80} className="absolute -right-4 -bottom-4 text-white/10 rotate-12" />
        </section>

        {isAdmin && (
          <div className="flex items-center justify-between p-4 rounded-2xl shadow-sm border border-[var(--separator)]"
            style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
                <Bell size={20} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Ride Voting</p>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>Enable or notify members</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={notifyAll}
                disabled={notifying || !isEnabled}
                className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-[12px] transition-all"
                style={{
                  backgroundColor: notified ? 'var(--green-bg)' : 'var(--accent-bg)',
                  color: notified ? 'var(--green)' : 'var(--accent)',
                }}
              >
                {notified ? <Check size={14} /> : <Bell size={14} />}
                {notified ? 'Sent' : 'Notify'}
              </button>
              <button
                onClick={toggleEnabled}
                className="w-12 h-6 rounded-full relative transition-colors duration-200"
                style={{ backgroundColor: isEnabled ? 'var(--green)' : 'var(--separator)' }}
              >
                <div
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                  style={{ transform: isEnabled ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>
        )}

        {isEnabled ? (
          <div className="space-y-4">
            {showReasonInput ? (
              <div className="card p-6 rounded-[24px] border border-[var(--separator)] bg-[var(--bg-card)] shadow-sm animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <MessageSquare size={20} className="text-gray-500" />
                  </div>
                  <h3 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>Why can&apos;t you make it?</h3>
                </div>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="e.g. Out of town, have an exam, work shift..."
                  rows={3}
                  className="w-full rounded-2xl p-4 text-[14px] resize-none outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--bg-card-2)',
                    color: 'var(--text-1)',
                    border: '1px solid var(--border-color)',
                  }}
                  autoFocus
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setShowReasonInput(false); setReasonText(''); }}
                    className="flex-1 py-3.5 rounded-xl text-[14px] font-bold transition-all"
                    style={{
                      backgroundColor: 'var(--bg-card-2)',
                      color: 'var(--text-2)',
                      border: '1px solid var(--separator)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitNoWithReason}
                    disabled={submittingReason || !reasonText.trim()}
                    className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white transition-all disabled:opacity-50"
                    style={{ backgroundColor: '#6b7280' }}
                  >
                    {submittingReason ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'yes', label: 'Needs Ride', icon: <ThumbsUp size={20} />, color: 'var(--accent)' },
                  { id: 'no', label: 'Not Coming', icon: <ThumbsDown size={20} />, color: '#6b7280' },
                  { id: 'coming_directly', label: 'Coming Directly', icon: <Walking size={20} />, color: 'var(--green)' },
                  { id: 'provide_ride', label: 'Can Provide Ride', icon: <Car size={20} />, color: '#3b82f6' }
                ].map((opt) => {
                  const isSelected = hasVoted === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVote(opt.id)}
                      className="w-full p-5 rounded-[24px] flex items-center justify-between transition-all active:scale-[0.98] border border-[var(--separator)]"
                      style={{
                        backgroundColor: isSelected ? opt.color : 'var(--bg-card)',
                        color: isSelected ? 'white' : 'var(--text-1)',
                        boxShadow: isSelected ? `0 8px 20px -6px ${opt.color}66` : 'none'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-card-2)' }}>
                          {opt.icon}
                        </div>
                        <span className="font-extrabold text-[15px]">{opt.label}</span>
                      </div>
                      {isSelected && <Check size={20} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center rounded-[32px] border border-[var(--separator)] bg-[var(--bg-card)] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-card-2)] flex items-center justify-center mx-auto mb-4">
              <Info size={32} className="text-[var(--text-3)]" />
            </div>
            <p className="font-extrabold text-lg" style={{ color: 'var(--text-1)' }}>Voting session ended</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Admin has disabled ride voting for now.</p>
          </div>
        )}

        {isAdmin && isEnabled && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--text-1)' }} />
              <h2 className="text-[14px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Live Status</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'yes', label: 'Needs Ride', color: '#ef4444', icon: <ThumbsUp size={14} /> },
                { id: 'provide_ride', label: 'Can Provide Ride', color: '#3b82f6', icon: <Car size={14} /> },
                { id: 'coming_directly', label: 'Coming Directly', color: '#10b981', icon: <Walking size={14} /> },
                { id: 'no', label: 'Not Coming', color: '#6b7280', icon: <ThumbsDown size={14} /> },
              ].map((group) => {
                const filtered = votes.filter(v => v.vote === group.id);
                return (
                  <div key={group.id} className="card rounded-[24px] border border-[var(--separator)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
                    <div className="px-5 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--separator)', backgroundColor: 'var(--bg-card-2)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: group.color }}>{group.icon}</span>
                        <span className="font-extrabold text-[13px] uppercase tracking-wider" style={{ color: group.color }}>{group.label}</span>
                      </div>
                      <span className="font-extrabold text-[13px]" style={{ color: 'var(--text-3)' }}>{filtered.length}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {filtered.length > 0 ? (
                        filtered.map(v => {
                          const member = members.find(m => m.id === v.member_id);
                          const memberName = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
                          
                          let reason: string | null = null;
                          if (group.id === 'no') {
                            const memberReason = absenceReasons.find(
                              r => r.member_id === v.member_id
                            );
                            reason = memberReason?.reason || null;
                          }

                          return (
                            <div key={v.id} className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <User size={14} className="text-[var(--text-4)]" />
                                <span className="text-[14px] font-bold" style={{ color: 'var(--text-1)' }}>
                                  {memberName}
                                </span>
                                {member?.phone && (
                                  <span className="text-[11px] font-medium opacity-50 ml-1">({member.phone})</span>
                                )}
                              </div>
                              {reason && (
                                <div className="ml-5 mt-1 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-[var(--separator)]">
                                  <p className="text-[12px] italic leading-relaxed" style={{ color: 'var(--text-3)' }}>
                                    &ldquo;{reason}&rdquo;
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex items-center justify-center py-2 opacity-30">
                          <span className="text-[12px] font-bold italic">No one yet</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
