import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface SabhaRideCardProps {
  householdId: string;
  memberId: string | null;
  isAdmin: boolean;
  isDark: boolean;
}

export function SabhaRideCard({ householdId, memberId, isAdmin, isDark }: SabhaRideCardProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

  // Reason flow state
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  // Absence reasons for admin
  const [absenceReasons, setAbsenceReasons] = useState<any[]>([]);

  useEffect(() => {
    if (householdId) {
      loadState();
    }
  }, [householdId, memberId]);

  const loadState = async () => {
    try {
      setLoading(true);

      // Check if feature is enabled
      const { data: statusData } = await supabase
        .from('sabha_ride_status')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle();

      setIsEnabled(statusData?.is_enabled ?? false);

      // Fetch user's vote
      if (memberId) {
        const { data: myVote } = await supabase
          .from('sabha_ride_votes')
          .select('vote')
          .eq('household_id', householdId)
          .eq('member_id', memberId)
          .maybeSingle();

        if (myVote) {
          setHasVoted(myVote.vote);
        } else {
          setHasVoted(null);
        }
      }

      // If admin, fetch all votes, members, and absence reasons
      if (isAdmin) {
        const [{ data: votesData }, { data: membersData }] = await Promise.all([
          supabase.from('sabha_ride_votes').select('*').eq('household_id', householdId),
          supabase.from('household_members').select('*').eq('household_id', householdId)
        ]);
        setVotes(votesData || []);
        setMembers(membersData || []);

        // Fetch absence reasons from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: reasons } = await supabase
          .from('sabha_absence_reasons')
          .select('*')
          .eq('household_id', householdId)
          .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
          .order('created_at', { ascending: false });
        setAbsenceReasons(reasons || []);
      }
    } catch (err) {
      console.error('Failed to load Sabha ride state:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (choice: string) => {
    if (!memberId || !householdId) return;

    // If user selects "no", show reason input instead of voting immediately
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
        loadState();
        setTimeout(() => setIsOpen(false), 500);
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const handleSubmitNoWithReason = async () => {
    if (!memberId || !householdId || !reasonText.trim()) return;

    try {
      setSubmittingReason(true);

      // Get member info for the reason record
      const { data: memberData } = await supabase
        .from('household_members')
        .select('first_name, last_name, email')
        .eq('id', memberId)
        .maybeSingle();

      // 1. Record the vote as "no"
      const { error: voteError } = await supabase
        .from('sabha_ride_votes')
        .upsert({
          household_id: householdId,
          member_id: memberId,
          vote: 'no',
          updated_at: new Date().toISOString()
        }, { onConflict: 'household_id,member_id' });

      if (voteError) throw voteError;

      // 2. Record the absence reason
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
      loadState();
      setTimeout(() => setIsOpen(false), 500);
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
        // Clearing votes when turning on
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
        alert('Notification sent!');
      } else {
        alert('Failed to send notification: ' + res.statusText);
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
      alert('Error sending notification');
    } finally {
      setNotifying(false);
    }
  };

  if (!isAdmin && !isEnabled) {
    return null;
  }

  const getVoteText = (vote: string) => {
    if (vote === 'yes') return 'Needs Ride';
    if (vote === 'no') return 'Not Coming';
    if (vote === 'coming_directly') return 'Coming Directly';
    if (vote === 'provide_ride') return 'Can Provide Ride';
    return 'Pending';
  };

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="mt-3 block rounded-3xl p-4 transition-transform active:scale-[0.97] relative overflow-hidden cursor-pointer shadow-sm glass-card"
      >
        <div style={{
          position: 'absolute', top: -18, right: -18,
          width: 80, height: 80, borderRadius: '50%',
          backgroundColor: 'var(--separator)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -24, left: -10,
          width: 60, height: 60, borderRadius: '50%',
          backgroundColor: 'var(--separator)', pointerEvents: 'none',
          opacity: 0.5,
        }} />

        <div className="flex justify-between items-center relative z-10">
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
              style={{
                backgroundColor: 'var(--separator)',
              }}>
              <span style={{ fontSize: 20 }}>🚗</span>
            </div>
            <p className="text-sm font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>
              Do you need ride for upcoming Sabha?
            </p>
          </div>

          <div className="ml-3 flex-shrink-0">
            {hasVoted ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ 
                  backgroundColor: 'var(--accent-bg)', 
                  color: 'var(--accent)' 
                }}>
                {getVoteText(hasVoted)}
              </span>
            ) : isEnabled ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full shadow-sm"
                style={{ 
                  backgroundColor: 'var(--accent)', 
                  color: '#fff' 
                }}>
                Vote
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ 
                  backgroundColor: 'var(--separator)', 
                  color: 'var(--text-3)' 
                }}>
                OFF
              </span>
            )}
          </div>
        </div>
      </div>

      <Sheet open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setShowReasonInput(false);
          setReasonText('');
        }
      }}>
        <SheetContent 
          side="bottom" 
          className="rounded-t-[32px] px-6 pb-8 h-auto"
          style={{ 
            backgroundColor: 'var(--bg)', 
            borderTop: '1px solid var(--border-color)', 
            maxHeight: showReasonInput ? '60dvh' : 'calc(85vh - env(safe-area-inset-top))', 
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)'
          }}
          onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
          onTouchEnd={(e) => {
            if (e.changedTouches[0].clientY - touchStartY > 60) setIsOpen(false);
          }}
          onMouseDown={(e) => setTouchStartY(e.clientY)}
          onMouseUp={(e) => {
            if (e.clientY - touchStartY > 60) setIsOpen(false);
          }}
        >
          <div className="flex-shrink-0 px-6" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
            <div className="w-12 h-1.5 rounded-full mx-auto mb-6 opacity-40" style={{ backgroundColor: 'var(--separator)' }} />
            <SheetHeader className="p-0 mb-6 text-left relative">
              <SheetTitle className="text-2xl font-bold flex items-center justify-between" style={{ color: 'var(--text-1)' }}>
                <span>Sabha Ride</span>
                {isAdmin && (
                  <button
                    onClick={notifyAll}
                    disabled={notifying || !isEnabled}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
                    aria-label="Send notification"
                  >
                    <span style={{ fontSize: 20 }}>🔔</span>
                  </button>
                )}
              </SheetTitle>
              <SheetDescription className="text-base" style={{ color: 'var(--text-3)' }}>
                Do you need ride for the upcoming Sabha??
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-grow overflow-y-auto px-6 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>

          {isAdmin && !showReasonInput && (
            <div className="flex items-center justify-between mb-6 p-4 rounded-2xl"
              style={{ backgroundColor: 'var(--bg-card-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-1)' }}>Enable Voting Session</span>
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
          )}

          {isEnabled ? (
            <>
              {/* Reason input overlay when user clicks "No" */}
              {showReasonInput ? (
                <div className="flex flex-col gap-4">
                  <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span style={{ fontSize: 20 }}>📝</span>
                      <p className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
                        Why can&apos;t you make it?
                      </p>
                    </div>
                    <textarea
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      placeholder="e.g. Out of town, have an exam, work shift..."
                      rows={3}
                      className="w-full rounded-xl p-4 text-[14px] resize-none outline-none transition-all"
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
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {[
                    { id: 'yes', label: 'Yes', icon: '👍' },
                    { id: 'no', label: 'No', icon: '👎' },
                    { id: 'coming_directly', label: 'Coming Directly', icon: '🚶' },
                    { id: 'provide_ride', label: 'Can Provide Ride', icon: '🚗' }
                  ].map((opt) => {
                    const isSelected = hasVoted === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleVote(opt.id)}
                        className="w-full p-4 rounded-2xl flex items-center justify-between transition-all"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                          color: isSelected ? 'white' : 'var(--text-1)',
                          border: isSelected ? 'none' : '1px solid var(--border-color)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span style={{ fontSize: 20 }}>{opt.icon}</span>
                          <span className="font-bold">{opt.label}</span>
                        </div>
                        {isSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center rounded-2xl" style={{ backgroundColor: 'var(--bg-card)' }}>
              <span className="text-4xl block mb-2">😴</span>
              <p className="font-semibold" style={{ color: 'var(--text-1)' }}>Voting ends</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Admin has disabled ride voting for now.</p>
            </div>
          )}

          {isAdmin && isEnabled && !showReasonInput && (
            <div className="mt-8">
              <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-1)' }}>Live Status</h3>
              <div className="space-y-4">
                {[
                  { id: 'yes', label: 'Needs Ride', color: '#ef4444' },
                  { id: 'provide_ride', label: 'Can Provide Ride', color: '#3b82f6' },
                  { id: 'coming_directly', label: 'Coming Directly', color: '#10b981' },
                  { id: 'no', label: 'Not Coming', color: '#6b7280' },
                ].map((group) => {
                  const filtered = votes.filter(v => v.vote === group.id);
                  return (
                    <div key={group.id} className="p-4 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm" style={{ color: group.color }}>{group.label} ({filtered.length})</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {filtered.length > 0 ? (
                          filtered.map(v => {
                            const member = members.find(m => m.id === v.member_id);
                            const memberName = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
                            
                            // If this is the "Not Coming" group, find the latest reason
                            let reason: string | null = null;
                            if (group.id === 'no') {
                              const memberReason = absenceReasons.find(
                                r => r.member_id === v.member_id
                              );
                              reason = memberReason?.reason || null;
                            }

                            return (
                              <div key={v.id}>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                                  • {memberName}
                                  {member?.phone ? ` (${member.phone})` : ''}
                                </span>
                                {reason && (
                                  <p className="text-xs ml-3 mt-0.5 italic" style={{ color: 'var(--text-3)' }}>
                                    &quot;{reason}&quot;
                                  </p>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-4)' }}>No one yet</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
